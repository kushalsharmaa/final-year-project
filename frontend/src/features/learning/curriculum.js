// src/features/learning/curriculum.js

// base list from basic to advanced
const CURRICULUM_PATH = [
  {
    id: "level_a1",
    title: "A1 starter",
    description: "Very simple English for daily life and short talks.",
    units: [
      {
        id: "a1_unit_1",
        title: "Hello and welcome",
        lessons: [
          {
            id: "a1_1_1_greetings",
            title: "Greetings",
            type: "speaking",
            summary: "Say hello and goodbye in a friendly way.",
          },
          {
            id: "a1_1_2_names",
            title: "Names and origin",
            type: "speaking",
            summary: "Introduce yourself and ask where people are from.",
          },
          {
            id: "a1_1_3_polite",
            title: "Polite words",
            type: "vocabulary",
            summary: "Use please, thank you and excuse me in context.",
          },
          {
            id: "a1_1_4_review",
            title: "Quick review one",
            type: "review",
            summary: "Short game to check greetings and polite words.",
          },
        ],
      },
      {
        id: "a1_unit_2",
        title: "Family and friends",
        lessons: [
          {
            id: "a1_2_1_family_words",
            title: "Family words",
            type: "vocabulary",
            summary: "Talk about mother, father, brother and sister.",
          },
          {
            id: "a1_2_2_people_describe",
            title: "Describe people",
            type: "grammar",
            summary: "Use be with adjectives to talk about people.",
          },
          {
            id: "a1_2_3_possessive",
            title: "My and your",
            type: "grammar",
            summary: "Use possessive words to show who owns things.",
          },
          {
            id: "a1_2_4_review",
            title: "Family mini game",
            type: "review",
            summary: "Match family words with pictures.",
          },
        ],
      },
      {
        id: "a1_unit_3",
        title: "Home and objects",
        lessons: [
          {
            id: "a1_3_1_house_words",
            title: "Rooms and furniture",
            type: "vocabulary",
            summary: "Name rooms and common things in a home.",
          },
          {
            id: "a1_3_2_there_is",
            title: "There is and there are",
            type: "grammar",
            summary: "Describe what is inside a room.",
          },
          {
            id: "a1_3_3_prepositions",
            title: "Place words",
            type: "grammar",
            summary: "Use in, on, under to say where things are.",
          },
          {
            id: "a1_3_4_review",
            title: "Home picture quiz",
            type: "review",
            summary: "Find items in a home picture from audio clues.",
          },
        ],
      },
      {
        id: "a1_unit_4",
        title: "Food and drinks",
        lessons: [
          {
            id: "a1_4_1_food_words",
            title: "Food words",
            type: "vocabulary",
            summary: "Talk about common meals and snacks.",
          },
          {
            id: "a1_4_2_like_dislike",
            title: "Likes and dislikes",
            type: "grammar",
            summary: "Use like to say what you enjoy eating.",
          },
          {
            id: "a1_4_3_order",
            title: "Order food",
            type: "speaking",
            summary: "Practice short talks in a cafe.",
          },
          {
            id: "a1_4_4_review",
            title: "Menu game",
            type: "review",
            summary: "Choose food from menus with simple tasks.",
          },
        ],
      },
      {
        id: "a1_unit_5",
        title: "Daily life",
        lessons: [
          {
            id: "a1_5_1_routine_words",
            title: "Daily actions",
            type: "vocabulary",
            summary: "Wake up, go to work and relax words.",
          },
          {
            id: "a1_5_2_present_simple",
            title: "Simple present",
            type: "grammar",
            summary: "Talk about what you do every day.",
          },
          {
            id: "a1_5_3_time",
            title: "Time and days",
            type: "vocabulary",
            summary: "Tell the time and name days of the week.",
          },
          {
            id: "a1_5_4_review",
            title: "Daily life challenge",
            type: "review",
            summary: "Short story game about a normal day.",
          },
        ],
      },
    ],
  },
  {
    id: "level_a2",
    title: "A2 base",
    description: "Grow your basic grammar and talk about past and plans.",
    units: [
      {
        id: "a2_unit_1",
        title: "Past events",
        lessons: [
          {
            id: "a2_1_1_past_simple_regular",
            title: "Past simple regular verbs",
            type: "grammar",
            summary: "Talk about yesterday with simple forms.",
          },
          {
            id: "a2_1_2_past_simple_irregular",
            title: "Past simple common irregulars",
            type: "grammar",
            summary: "Use went, saw, did and more.",
          },
          {
            id: "a2_1_3_story",
            title: "Past story",
            type: "speaking",
            summary: "Tell a short story about last weekend.",
          },
          {
            id: "a2_1_4_review",
            title: "Past tense game",
            type: "review",
            summary: "Change present sentences to past in a quiz.",
          },
        ],
      },
      {
        id: "a2_unit_2",
        title: "Travel basics",
        lessons: [
          {
            id: "a2_2_1_airport_words",
            title: "Airport words",
            type: "vocabulary",
            summary: "Check in, gate and boarding words.",
          },
          {
            id: "a2_2_2_questions",
            title: "Travel questions",
            type: "speaking",
            summary: "Ask for directions and information.",
          },
          {
            id: "a2_2_3_hotel",
            title: "At the hotel",
            type: "dialog",
            summary: "Practice check in and simple requests.",
          },
          {
            id: "a2_2_4_review",
            title: "Travel mission",
            type: "review",
            summary: "Complete a small travel story with choices.",
          },
        ],
      },
      {
        id: "a2_unit_3",
        title: "Future plans",
        lessons: [
          {
            id: "a2_3_1_going_to",
            title: "Going to plans",
            type: "grammar",
            summary: "Talk about plans with going to.",
          },
          {
            id: "a2_3_2_will",
            title: "Will for decisions",
            type: "grammar",
            summary: "Use will when you decide in the moment.",
          },
          {
            id: "a2_3_3_schedule",
            title: "Schedule talk",
            type: "speaking",
            summary: "Share next week plans with a partner bot.",
          },
          {
            id: "a2_3_4_review",
            title: "Future card game",
            type: "review",
            summary: "Choose correct tense for different plans.",
          },
        ],
      },
      {
        id: "a2_unit_4",
        title: "Describing things",
        lessons: [
          {
            id: "a2_4_1_adjectives",
            title: "Common adjectives",
            type: "vocabulary",
            summary: "Big, small, interesting and boring words.",
          },
          {
            id: "a2_4_2_comparative",
            title: "Comparatives",
            type: "grammar",
            summary: "Compare two people or things.",
          },
          {
            id: "a2_4_3_superlative",
            title: "Superlatives",
            type: "grammar",
            summary: "Talk about the best or worst thing.",
          },
          {
            id: "a2_4_4_review",
            title: "Describe and guess",
            type: "review",
            summary: "Guess items from short descriptions.",
          },
        ],
      },
      {
        id: "a2_unit_5",
        title: "Work and study",
        lessons: [
          {
            id: "a2_5_1_jobs",
            title: "Job words",
            type: "vocabulary",
            summary: "Talk about jobs and workplaces.",
          },
          {
            id: "a2_5_2_routines",
            title: "Work routines",
            type: "speaking",
            summary: "Describe tasks you do at work or school.",
          },
          {
            id: "a2_5_3_emails",
            title: "Simple emails",
            type: "writing",
            summary: "Write short clear emails.",
          },
          {
            id: "a2_5_4_review",
            title: "Work and study quiz",
            type: "review",
            summary: "Choose best phrases for work situations.",
          },
        ],
      },
    ],
  },
  {
    id: "level_b1",
    title: "B1 bridge",
    description: "Move to more natural English for longer talks.",
    units: [
      {
        id: "b1_unit_1",
        title: "Opinions and reasons",
        lessons: [
          {
            id: "b1_1_1_opinion_words",
            title: "Opinion words",
            type: "vocabulary",
            summary: "Useful words for what you think and feel.",
          },
          {
            id: "b1_1_2_because",
            title: "Give reasons",
            type: "grammar",
            summary: "Use because and so in longer sentences.",
          },
          {
            id: "b1_1_3_discussion",
            title: "Small debate",
            type: "speaking",
            summary: "Agree and disagree in a safe polite way.",
          },
          {
            id: "b1_1_4_review",
            title: "Opinion challenge",
            type: "review",
            summary: "Choose good support for opinions.",
          },
        ],
      },
      {
        id: "b1_unit_2",
        title: "Stories and news",
        lessons: [
          {
            id: "b1_2_1_linking",
            title: "Linking words",
            type: "grammar",
            summary: "Use first, then, after that and finally.",
          },
          {
            id: "b1_2_2_story_past",
            title: "Longer story in past",
            type: "speaking",
            summary: "Tell a story with clear order.",
          },
          {
            id: "b1_2_3_news_words",
            title: "Simple news",
            type: "vocabulary",
            summary: "Understand common news topics.",
          },
          {
            id: "b1_2_4_review",
            title: "Story puzzle",
            type: "review",
            summary: "Put story parts in correct order.",
          },
        ],
      },
      {
        id: "b1_unit_3",
        title: "Health and lifestyle",
        lessons: [
          {
            id: "b1_3_1_health_words",
            title: "Health words",
            type: "vocabulary",
            summary: "Talk about health and common problems.",
          },
          {
            id: "b1_3_2_advice",
            title: "Giving advice",
            type: "grammar",
            summary: "Use should and must for advice.",
          },
          {
            id: "b1_3_3_doctor",
            title: "At the doctor",
            type: "dialog",
            summary: "Role play a visit to the doctor.",
          },
          {
            id: "b1_3_4_review",
            title: "Health mini test",
            type: "review",
            summary: "Choose correct advice for each problem.",
          },
        ],
      },
      {
        id: "b1_unit_4",
        title: "Plans and goals",
        lessons: [
          {
            id: "b1_4_1_future_forms",
            title: "Future forms mix",
            type: "grammar",
            summary: "Use different forms to talk about future.",
          },
          {
            id: "b1_4_2_goal_talk",
            title: "Life goals",
            type: "speaking",
            summary: "Talk about study, work and travel goals.",
          },
          {
            id: "b1_4_3_project",
            title: "Simple project plan",
            type: "writing",
            summary: "Write a short plan with steps and dates.",
          },
          {
            id: "b1_4_4_review",
            title: "Goal tracker game",
            type: "review",
            summary: "Choose good next steps for sample goals.",
          },
        ],
      },
      {
        id: "b1_unit_5",
        title: "Culture and media",
        lessons: [
          {
            id: "b1_5_1_movies",
            title: "Films and series",
            type: "vocabulary",
            summary: "Talk about favourite shows and films.",
          },
          {
            id: "b1_5_2_reviews",
            title: "Give short review",
            type: "writing",
            summary: "Write simple review of a film or book.",
          },
          {
            id: "b1_5_3_social_media",
            title: "Social media talk",
            type: "speaking",
            summary: "Describe your online habits.",
          },
          {
            id: "b1_5_4_review",
            title: "Media quiz",
            type: "review",
            summary: "Match phrases with media situations.",
          },
        ],
      },
    ],
  },
  {
    id: "level_b2",
    title: "B2 power",
    description: "Stronger grammar and style for exams and work.",
    units: [
      {
        id: "b2_unit_1",
        title: "Complex sentences",
        lessons: [
          {
            id: "b2_1_1_connectors",
            title: "Connectors",
            type: "grammar",
            summary: "Use although, however and despite.",
          },
          {
            id: "b2_1_2_relative",
            title: "Relative clauses",
            type: "grammar",
            summary: "Add extra information to a sentence.",
          },
          {
            id: "b2_1_3_paragraph",
            title: "Strong paragraph",
            type: "writing",
            summary: "Write a clear topic sentence with support.",
          },
          {
            id: "b2_1_4_review",
            title: "Sentence builder",
            type: "review",
            summary: "Join short ideas into complex sentences.",
          },
        ],
      },
      {
        id: "b2_unit_2",
        title: "Conditionals",
        lessons: [
          {
            id: "b2_2_1_first_conditional",
            title: "First conditional",
            type: "grammar",
            summary: "If plus present for real future results.",
          },
          {
            id: "b2_2_2_second_conditional",
            title: "Second conditional",
            type: "grammar",
            summary: "Talk about unreal but possible ideas.",
          },
          {
            id: "b2_2_3_mixed",
            title: "Mix of conditionals",
            type: "grammar",
            summary: "Choose best conditional for each case.",
          },
          {
            id: "b2_2_4_review",
            title: "Conditional mission",
            type: "review",
            summary: "Play through a choice story with if forms.",
          },
        ],
      },
      {
        id: "b2_unit_3",
        title: "Academic language",
        lessons: [
          {
            id: "b2_3_1_formal_words",
            title: "Formal versus informal",
            type: "vocabulary",
            summary: "Swap casual words for formal ones.",
          },
          {
            id: "b2_3_2_signposting",
            title: "Signposting",
            type: "grammar",
            summary: "Guide the reader through your text.",
          },
          {
            id: "b2_3_3_summary",
            title: "Summarising",
            type: "writing",
            summary: "Write short summary of a longer text.",
          },
          {
            id: "b2_3_4_review",
            title: "Academic challenge",
            type: "review",
            summary: "Fix style problems in sample texts.",
          },
        ],
      },
      {
        id: "b2_unit_4",
        title: "Business talk",
        lessons: [
          {
            id: "b2_4_1_meetings",
            title: "Meetings",
            type: "speaking",
            summary: "Join a meeting and share ideas clearly.",
          },
          {
            id: "b2_4_2_email_style",
            title: "Business email style",
            type: "writing",
            summary: "Write clear and polite work emails.",
          },
          {
            id: "b2_4_3_negotiation_words",
            title: "Negotiation language",
            type: "vocabulary",
            summary: "Useful phrases for making offers.",
          },
          {
            id: "b2_4_4_review",
            title: "Office role play",
            type: "review",
            summary: "Handle small office situations in a game.",
          },
        ],
      },
      {
        id: "b2_unit_5",
        title: "Exam skills",
        lessons: [
          {
            id: "b2_5_1_listening",
            title: "Listening tricks",
            type: "listening",
            summary: "Practice common exam question types.",
          },
          {
            id: "b2_5_2_reading",
            title: "Reading tricks",
            type: "reading",
            summary: "Find key information fast in texts.",
          },
          {
            id: "b2_5_3_speaking_exam",
            title: "Speaking parts",
            type: "speaking",
            summary: "Follow typical exam speaking tasks.",
          },
          {
            id: "b2_5_4_review",
            title: "Exam mini mock",
            type: "review",
            summary: "Short mixed task as mini exam.",
          },
        ],
      },
    ],
  },
  {
    id: "level_c1",
    title: "C1 expert path",
    description: "Fine tune advanced language for study and work.",
    units: [
      {
        id: "c1_unit_1",
        title: "Nuance and tone",
        lessons: [
          {
            id: "c1_1_1_register",
            title: "Register control",
            type: "vocabulary",
            summary: "Choose tone that fits each situation.",
          },
          {
            id: "c1_1_2_emphasis",
            title: "Emphasis",
            type: "grammar",
            summary: "Use cleft sentences and fronting.",
          },
          {
            id: "c1_1_3_implication",
            title: "Implied meaning",
            type: "reading",
            summary: "Read between lines in short texts.",
          },
          {
            id: "c1_1_4_review",
            title: "Tone quiz",
            type: "review",
            summary: "Choose tone that matches context.",
          },
        ],
      },
      {
        id: "c1_unit_2",
        title: "Complex argument",
        lessons: [
          {
            id: "c1_2_1_argument_structure",
            title: "Argument structure",
            type: "writing",
            summary: "Build strong paragraph logic.",
          },
          {
            id: "c1_2_2_hedging",
            title: "Hedging",
            type: "grammar",
            summary: "Use language that sounds careful and precise.",
          },
          {
            id: "c1_2_3_counter_argument",
            title: "Counter arguments",
            type: "writing",
            summary: "Present and answer other views.",
          },
          {
            id: "c1_2_4_review",
            title: "Essay clinic",
            type: "review",
            summary: "Fix logic in sample argument texts.",
          },
        ],
      },
      {
        id: "c1_unit_3",
        title: "Advanced listening",
        lessons: [
          {
            id: "c1_3_1_accents",
            title: "Different accents",
            type: "listening",
            summary: "Practice with a mix of native accents.",
          },
          {
            id: "c1_3_2_note_taking",
            title: "Note taking",
            type: "listening",
            summary: "Take notes from short lectures.",
          },
          {
            id: "c1_3_3_podcasts",
            title: "Podcast tasks",
            type: "listening",
            summary: "Understand long natural talks.",
          },
          {
            id: "c1_3_4_review",
            title: "Listening review",
            type: "review",
            summary: "Mixed listening tasks with feedback.",
          },
        ],
      },
      {
        id: "c1_unit_4",
        title: "Presentations",
        lessons: [
          {
            id: "c1_4_1_signals",
            title: "Presentation signals",
            type: "speaking",
            summary: "Guide listeners through a talk.",
          },
          {
            id: "c1_4_2_storytelling",
            title: "Storytelling in talks",
            type: "speaking",
            summary: "Use stories to support key points.",
          },
          {
            id: "c1_4_3_slides",
            title: "Slide language",
            type: "writing",
            summary: "Write clear slide text.",
          },
          {
            id: "c1_4_4_review",
            title: "Talk builder",
            type: "review",
            summary: "Arrange parts of a strong talk.",
          },
        ],
      },
      {
        id: "c1_unit_5",
        title: "Professional writing",
        lessons: [
          {
            id: "c1_5_1_reports",
            title: "Reports",
            type: "writing",
            summary: "Structure formal reports with sections.",
          },
          {
            id: "c1_5_2_proposals",
            title: "Proposals",
            type: "writing",
            summary: "Write clear proposals with aims and impact.",
          },
          {
            id: "c1_5_3_email_chains",
            title: "Complex email threads",
            type: "reading",
            summary: "Follow and reply to long email chains.",
          },
          {
            id: "c1_5_4_review",
            title: "Writing lab",
            type: "review",
            summary: "Improve sample emails and reports.",
          },
        ],
      },
    ],
  },
];

// build helpers
export const CURRICULUM = Object.fromEntries(
  CURRICULUM_PATH.map((level) => [level.id, level])
);

export const LESSON_ORDER = [];
export const ALL_LESSONS = {};

const XP_BY_TYPE = {
  vocabulary: 12,
  speaking: 14,
  dialog: 14,
  grammar: 12,
  review: 10,
  writing: 12,
  reading: 10,
};

const MINUTES_BY_TYPE = {
  vocabulary: 6,
  speaking: 8,
  dialog: 8,
  grammar: 7,
  review: 5,
  writing: 8,
  reading: 6,
};

function ensureArray(val, fallback) {
  if (!val) return fallback || [];
  if (Array.isArray(val)) return val;
  return [val];
}

function deriveKeyWords(lesson, unit, level) {
  if (lesson.keyWords && lesson.keyWords.length) return lesson.keyWords;
  const picks = new Set();
  const pushWords = (txt) => {
    (txt || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w && w.length > 3)
      .forEach((w) => picks.add(w));
  };
  pushWords(lesson.title);
  pushWords(unit.title);
  pushWords(level.title);
  return Array.from(picks).slice(0, 5);
}

function deriveKeyPhrases(lesson) {
  if (lesson.keyPhrases && lesson.keyPhrases.length) return lesson.keyPhrases;
  const base = lesson.title || "this topic";
  const summary = lesson.summary || "Practice the core idea with short phrases.";
  return [
    `Let's talk about ${base.toLowerCase()}.`,
    `${summary}`,
    `Can you share an example of ${base.toLowerCase()}?`,
  ];
}

function deriveExampleSentences(lesson) {
  if (lesson.exampleSentences && lesson.exampleSentences.length) return lesson.exampleSentences;
  const title = lesson.title || "this lesson";
  return [
    `I am practicing ${title.toLowerCase()} today.`,
    `Here is a simple line about ${title.toLowerCase()}.`,
    `Can you repeat the ${title.toLowerCase()} sentence slowly?`,
  ].slice(0, 3);
}

function deriveQuickCheck(lesson) {
  if (lesson.quickCheck && lesson.quickCheck.length) return lesson.quickCheck;
  const answerA = lesson.title || "This lesson";
  const answerB = lesson.summary || "It is about daily practice.";
  return [
    {
      id: `${lesson.id}_qc1`,
      type: "mcq",
      prompt: `What is the focus of "${lesson.title}"?`,
      options: [answerA, "A random topic", "Unrelated grammar"],
      answer: answerA,
    },
    {
      id: `${lesson.id}_qc2`,
      type: "mcq",
      prompt: `How should you use this in a sentence?`,
      options: [answerB, "Avoid using it", "Only write it"],
      answer: answerB,
    },
  ];
}

function deriveTags(lesson, unit, level) {
  if (lesson.tags && lesson.tags.length) return lesson.tags;
  const base = [];
  const pushWords = (txt) => {
    (txt || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w && w.length > 3)
      .forEach((w) => base.push(w));
  };
  pushWords(lesson.title);
  pushWords(unit.title);
  pushWords(level.title);
  return Array.from(new Set([lesson.type, ...base])).slice(0, 5);
}

for (const level of CURRICULUM_PATH) {
  for (const unit of level.units) {
    for (const lesson of unit.lessons) {
      const explanation =
        lesson.explanation ||
        `${lesson.summary || lesson.title || "Practice this topic"} Use it in short sentences and focus on clarity.`;
      const keyWords = deriveKeyWords(lesson, unit, level);
      const keyPhrases = ensureArray(lesson.keyPhrases, deriveKeyPhrases(lesson));
      const exampleSentences = ensureArray(lesson.exampleSentences, deriveExampleSentences(lesson));
      const quickCheck = ensureArray(lesson.quickCheck, deriveQuickCheck(lesson));

      const xpReward = lesson.xpReward || XP_BY_TYPE[lesson.type] || 10;
      const estimatedMinutes =
        lesson.estimatedMinutes || MINUTES_BY_TYPE[lesson.type] || 6;
      const tags = deriveTags(lesson, unit, level);
      LESSON_ORDER.push(lesson.id);
      ALL_LESSONS[lesson.id] = {
        ...lesson,
        explanation,
        keyWords,
        keyPhrases,
        exampleSentences,
        quickCheck,
        levelId: level.id,
        unitId: unit.id,
        levelTitle: level.title,
        unitTitle: unit.title,
        xpReward,
        estimatedMinutes,
        tags,
      };
    }
  }
}
