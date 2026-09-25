/**
 * Romanized Indic (Hinglish) keyword dictionary used for heuristic language detection.
 * Bhashini TLD labels all Latin-script text as 'en'. This list bridges the gap
 * by identifying queries written in Romanized Hindi.
 *
 * Distinguishes strong, unambiguous Indic words from ambiguous words that clash
 * with English stopwords (e.g., 'the', 'to', 'me', 'in').
 */

// Strong, unambiguous Romanized Hindi keywords
export const STRONG_INDIC_KEYWORDS = Object.freeze({
  // Weather-specific Indic terms
  weather: [
    'mausam', 'mosam', 'mousam', 'baarish', 'barish', 'barsaat', 'badal', 'baadal',
    'garmi', 'thand', 'thandi', 'dhoop', 'hawa', 'toofan', 'kohra',
    'tapman', 'taapman', 'barsat', 'ola', 'ole', 'jhadi'
  ],

  // Interrogative / Question words
  questions: [
    'kya', 'kaisa', 'kaisi', 'kaise', 'kab', 'kaha', 'kahan', 'kyu', 'kyun',
    'kitna', 'kitni', 'kitne', 'kaun', 'kaunsa', 'kaunsi'
  ],

  // Time & Temporal expressions
  time: [
    'aaj', 'kal', 'parso', 'tarso', 'subah', 'dopahar', 'shaam', 'sham', 'raat',
    'hafte', 'mahine', 'abhi', 'samay', 'waqt'
  ],

  // Auxiliaries & Common Verbs
  verbs: [
    'hai', 'hain', 'hoga', 'hogi', 'hoge', 'tha', 'thi',
    'rahega', 'rahegi', 'rahenge', 'aayega', 'aayegi', 'aayenge',
    'batao', 'bataiye', 'batana', 'bolo', 'karo', 'dekho', 'lag', 'lagta', 'lagti'
  ],

  // Pronouns & Particles
  pronounsAndParticles: [
    'mujhe', 'mera', 'meri', 'mere', 'hum', 'hume', 'humara', 'aap', 'aapka', 'aapki',
    'tum', 'tumhara', 'tumhari', 'yaha', 'yahan', 'waha', 'wahan', 'mein', 'nahi', 'nahin'
  ],
});

// Ambiguous words that exist in both Indic romanization and English
export const AMBIGUOUS_WORDS = new Set([
  'the', 'to', 'me', 'in', 'so', 'do', 'mat', 'par', 'se', 'ko', 'ke', 'ki', 'ka', 'din'
]);

// Flat Set of all strong keywords for O(1) lookup
const ALL_STRONG_KEYWORDS = new Set(
  Object.values(STRONG_INDIC_KEYWORDS)
    .flat()
    .map((word) => word.toLowerCase())
);

/**
 * Checks if a Latin-script text contains romanized Hindi words.
 * Requires at least one strong unambiguous Indic keyword to avoid false positives
 * with common English words.
 *
 * @param {string} text - The input query
 * @param {number} minMatches - Minimum number of distinct matched keywords (default 1)
 * @returns {{ isMatch: boolean, matchedKeywords: string[], matchCount: number }}
 */
export function detectRomanizedHindi(text, minMatches = 1) {
  if (!text || typeof text !== 'string') {
    return { isMatch: false, matchedKeywords: [], matchCount: 0 };
  }

  // Tokenize into clean lowercase words
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);

  const matchedStrong = new Set();
  const matchedAmbiguous = new Set();

  for (const token of tokens) {
    if (ALL_STRONG_KEYWORDS.has(token)) {
      matchedStrong.add(token);
    } else if (AMBIGUOUS_WORDS.has(token)) {
      matchedAmbiguous.add(token);
    }
  }

  // A match is only valid if there is at least one strong Indic word present
  const hasStrongMatch = matchedStrong.size >= minMatches;
  const allMatched = hasStrongMatch
    ? [...Array.from(matchedStrong), ...Array.from(matchedAmbiguous)]
    : [];

  return {
    isMatch: hasStrongMatch,
    matchedKeywords: allMatched,
    matchCount: allMatched.length,
  };
}

export default detectRomanizedHindi;

