// src/features/recommendNext.js
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function recommendNext(
  lessons,
  userLevel,
  focusAreas = ["vocab", "pronunciation"],
  interests = [],
  skillGaps = {},
  completedIds = new Set(),
  timeBudgetMin = 10,
  opts = {}
) {
  const weakWords = (opts.weakWords || []).map(w => (w || "").toLowerCase());
  const levelOrder = LEVELS;
  const li = Math.max(0, levelOrder.indexOf(userLevel));

  const scored = lessons
    .filter(l => !completedIds.has(l.id))
    // filter: within userLevel .. userLevel+1
    .filter(l => levelOrder.indexOf(l.level) <= Math.min(li + 1, levelOrder.length - 1))
    .map(l => {
      // focus boost
      const focusBoost = (focusAreas || []).reduce((s, k) => s + (l.skills?.[k] || 0), 0);

      // skill gaps boost
      const gapBoost = Object.entries(skillGaps || {}).reduce(
        (s, [k, v]) => s + Number(v || 0) * (l.skills?.[k] || 0),
        0
      );

      // interest boost
      const interestBoost = (l.tags || []).some(t => interests.includes(t)) ? 0.2 : 0;

      // weak word boost: if any pron card phrase contains weak words
      const text = (l.items || [])
        .filter(it => it?.type === "pronPhrase")
        .map(it => (it.phrase || "").toLowerCase())
        .join(" • ");
      const weakHitCount = weakWords.length
        ? weakWords.reduce((cnt, w) => (w && text.includes(w) ? cnt + 1 : cnt), 0)
        : 0;
      const weakBoost = Math.min(0.6, 0.15 * weakHitCount); // up to +0.6

      // level penalty (slight)
      const levelPenalty = Math.max(0, levelOrder.indexOf(l.level) - li) * -0.15;

      const score = 0.5 * focusBoost + 0.35 * gapBoost + 0.2 * interestBoost + weakBoost + levelPenalty;

      return { l, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(s => s.l);

  // time slicing
  const plan = [];
  let t = 0;
  for (const l of scored) {
    const minutes = Number(l.estimatedMinutes || 0);
    if (t + minutes <= timeBudgetMin) {
      plan.push(l);
      t += minutes;
    }
    if (t >= timeBudgetMin) break;
  }
  return plan.length ? plan : scored.slice(0, 1);
}
