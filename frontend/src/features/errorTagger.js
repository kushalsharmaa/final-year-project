// src/features/errorTagger.js
// turns target + transcript into actionable tags

// simple phoneme patterns we can infer from words
const PHON_TAGS = [
    { test: /th/, tag: "P_PHON_DENTAL_FRIC_TH", note: "trouble with TH sound" },
    { test: /\br/, tag: "P_PHON_R_COLORING", note: "trouble with R sound" },
    { test: /l.*r|r.*l/, tag: "P_PHON_L_R_CONFUSION", note: "L and R confusion" },
    { test: /[aeiou]{2}/, tag: "P_PHON_VOWEL_LENGTH", note: "vowel length or diphthong" },
  ];
  
  export function tagErrors({ target, transcript, words = [] }) {
    const out = [];
  
    const T = String(target || "").toLowerCase().trim();
    const H = String(transcript || "").toLowerCase().trim();
  
    if (!T) return out;
  
    // very light grammar hints
    if (/\b(yesterday|last|ago)\b/.test(T)) {
      // if target is past oriented but hypothesis keeps base form often
      const wentLike = /\b(went|was|were|did|had|took|made|said|went)\b/;
      if (!wentLike.test(H) && /\b(go|be|do|have|take|make|say|go)\b/.test(H)) {
        out.push({
          tag: "G_TENSE_V_PAST_IRREG",
          cat: "grammar",
          note: "past irregular verb likely wrong",
          evidence: { target: T, transcript: H },
        });
      }
    }
  
    // vocabulary adjective misuse boring vs bored style
    if (/\bboring\b/.test(H) && /\bthe movie\b/.test(H)) {
      out.push({
        tag: "V_ADJ_MISUSE_ED_ING",
        cat: "vocab",
        note: "ed vs ing adjective misuse",
      });
    }
  
    // phoneme from per word statuses
    const wrongWords = (words || []).filter(w =>
      ["substitution", "deletion"].includes(w.status)
    );
  
    const probe = (wrongWords.length ? wrongWords : words).map(w => (w.expected || w.text || "").toLowerCase());
  
    for (const w of probe) {
      for (const rule of PHON_TAGS) {
        if (rule.test.test(w)) {
          out.push({ tag: rule.tag, cat: "phon", note: rule.note, evidence: { word: w } });
        }
      }
    }
  
    // collapse duplicates
    const seen = new Set();
    return out.filter(t => {
      if (seen.has(t.tag)) return false;
      seen.add(t.tag);
      return true;
    });
  }
  