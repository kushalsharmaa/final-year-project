// src/features/learning/contentSeed.js
export const CONTENT_SEED = [
    {
      id: "c_a2_v_pron_1",
      title: "Day-to-day phrases & TH sound",
      type: "micro-lesson",
      level: "A2",
      tags: ["daily", "th"],
      skills: { vocab: 0.5, pronunciation: 0.6 },
      estimatedMinutes: 6,
      items: [
        { id: "i1", type: "mcq", prompt: "Synonym of 'help'", options: ["ignore", "assist", "argue", "push"], answerIndex: 1, skill: "vocab", wordIfWrong: "assist" },
        { id: "i2", type: "mcq", prompt: "Opposite of 'difficult'", options: ["easy", "heavy", "late", "short"], answerIndex: 0, skill: "vocab", wordIfWrong: "difficult" },
        { id: "p1", type: "pronPhrase", phrase: "Three thin thieves thought things through.", skill: "pronunciation" },
      ],
    },
    {
      id: "c_b1_pron_rl_1",
      title: "R/L contrast drill",
      type: "pronunciation-drill",
      level: "B1",
      tags: ["pronunciation", "r-l-contrast"],
      skills: { pronunciation: 1 },
      estimatedMinutes: 4,
      items: [
        { id: "p2", type: "pronPhrase", phrase: "The red ladder rolled along the road.", skill: "pronunciation" },
        { id: "p3", type: "pronPhrase", phrase: "Really rainy weather later.", skill: "pronunciation" },
      ],
    },
    {
      id: "c_a2_quiz_1",
      title: "Quick vocab check (travel)",
      type: "quiz",
      level: "A2",
      tags: ["travel", "vocab"],
      skills: { vocab: 0.9 },
      estimatedMinutes: 5,
      items: [
        { id: "i3", type: "mcq", prompt: "Meaning of 'itinerary'", options: ["ticket", "travel plan", "passport", "hotel"], answerIndex: 1, skill: "vocab", wordIfWrong: "itinerary" },
        { id: "i4", type: "mcq", prompt: "Closest to 'departure'", options: ["arrival", "boarding", "leaving", "delaying"], answerIndex: 2, skill: "vocab", wordIfWrong: "departure" },
      ],
    },
  ];
  