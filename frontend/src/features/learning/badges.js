export const BADGE_STEPS = [5, 15, 30];

export function getBadgeStatus(completedCount = 0) {
  const total = Number.isFinite(completedCount) ? Math.max(0, completedCount) : 0;
  const nextTarget = BADGE_STEPS.find((step) => total < step) || null;
  const currentLevel = BADGE_STEPS.reduce((acc, step) => (total >= step ? acc + 1 : acc), 0);
  const progress = nextTarget ? Math.min(1, total / nextTarget) : 1;
  const remaining = nextTarget ? Math.max(0, nextTarget - total) : 0;

  return {
    completedCount: total,
    currentLevel,
    nextTarget,
    progress,
    remaining,
  };
}
