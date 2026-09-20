/**
 * Keyword Matching Engine for Resume Studio.
 * Deterministically extracts domain keywords, computes match statistics,
 * and losslessly segments text for UI highlight rendering.
 */

export const MIN_WORD_LENGTH = 3;

/**
 * Represents match statistics between resume text and job description keywords.
 */
export interface KeywordMatchStats {
  /** Total number of unique keywords extracted from the Job Description */
  totalKeywords: number;
  /** Number of JD keywords matched in the resume */
  matchedCount: number;
  /** Backward-compatible alias for matchedCount */
  matchCount: number;
  /** Percentage of JD keywords matched (integer 0-100) */
  matchPercentage: number;
  /** Alphabetically sorted list of keywords found in both JD and resume */
  matchedKeywords: string[];
  /** Alphabetically sorted list of JD keywords missing from the resume */
  missingKeywords: string[];
}

/**
 * Text segment for lossless UI highlighting.
 */
export interface TextSegment {
  /** Original substring text preserving exact casing and whitespace */
  text: string;
  /** True if this token represents a matched keyword */
  isMatch: boolean;
}

/**
 * Comprehensive 214-word taxonomy of English stop words and recruiting boilerplate.
 */
export const STOP_WORDS = new Set<string>([
  // 1. Articles & Determiners (18)
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'each', 'every', 'either',
  'neither', 'some', 'any', 'all', 'both', 'another', 'such', 'whatever',

  // 2. Pronouns (34)
  'i', 'me', 'my', 'myself', 'we', 'us', 'our', 'ours', 'ourselves', 'you',
  'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
  'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them',
  'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'whose',

  // 3. Auxiliary & Primary Verbs (36)
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'having', 'do', 'does', 'did', 'doing', 'done', 'will', 'would',
  'shall', 'should', 'may', 'might', 'must', 'can', 'could', 'need', 'needed',
  'needs', 'dare', 'ought', 'used', 'get', 'gets', 'got', 'getting',

  // 4. Prepositions (38)
  'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around',
  'at', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond',
  'by', 'down', 'during', 'except', 'for', 'from', 'in', 'inside', 'into',
  'like', 'near', 'of', 'off', 'on', 'onto', 'out', 'outside', 'over',
  'through', 'throughout', 'till', 'to', 'toward', 'towards', 'under',
  'underneath', 'until', 'up', 'upon', 'via', 'with', 'within', 'without',

  // 5. Conjunctions & Connectives (18)
  'and', 'but', 'or', 'nor', 'so', 'yet', 'although', 'because', 'since',
  'unless', 'while', 'whereas', 'whether', 'though', 'even', 'if', 'then', 'once',

  // 6. Adverbs, Quantifiers & Common Modifiers (30)
  'here', 'there', 'where', 'when', 'why', 'how', 'few', 'more', 'most',
  'much', 'many', 'other', 'others', 'several', 'no', 'not', 'only', 'own',
  'same', 'than', 'too', 'very', 'just', 'also', 'now', 'always', 'never',
  'already', 'still', 'again', 'further', 'well', 'almost', 'quite',

  // 7. Job-Posting Filler & Generic Boilerplate (40)
  'role', 'roles', 'position', 'positions', 'job', 'jobs', 'work', 'works',
  'working', 'team', 'teams', 'company', 'companies', 'looking', 'seeking',
  'required', 'requires', 'requirement', 'requirements', 'responsibility',
  'responsibilities', 'qualification', 'qualifications', 'preferred', 'experience',
  'experiences', 'experienced', 'year', 'years', 'ability', 'abilities',
  'skill', 'skills', 'knowledge', 'strong', 'excellent', 'good', 'great',
  'include', 'includes', 'including', 'etc',
]);

/**
 * Extracts normalized, deduplicated keywords from input text.
 * Filters against stop words, pure numbers, and words shorter than MIN_WORD_LENGTH.
 */
export function extractKeywords(text: string): Set<string> {
  const keywords = new Set<string>();
  if (!text || typeof text !== 'string') return keywords;

  // Split by non-alphanumeric and non-hyphen characters
  const rawTokens = text.toLowerCase().split(/[^a-z0-9-]+/);

  for (const token of rawTokens) {
    // Strip leading and trailing hyphens (e.g. "-fastapi-" -> "fastapi")
    const word = token.replace(/^-+|-+$/g, '');

    // Filter conditions:
    // 1. Minimum word length (>= 3 chars)
    // 2. Not in STOP_WORDS dictionary
    // 3. Not purely numeric (e.g. "2024", "100" rejected, but "k8s", "ec2", "html5" kept)
    if (
      word.length >= MIN_WORD_LENGTH &&
      !STOP_WORDS.has(word) &&
      !/^\d+$/.test(word)
    ) {
      keywords.add(word);
    }
  }

  return keywords;
}

/**
 * Calculates match metrics between resume text and JD keywords.
 * Returns total count, matched count, match percentage, and sorted lists of matched and missing keywords.
 */
export function calculateMatchStats(
  resumeText: string,
  jdKeywords: Set<string>
): KeywordMatchStats {
  const totalKeywords = jdKeywords ? jdKeywords.size : 0;

  if (totalKeywords === 0) {
    return {
      totalKeywords: 0,
      matchedCount: 0,
      matchCount: 0,
      matchPercentage: 0,
      matchedKeywords: [],
      missingKeywords: [],
    };
  }

  const resumeKeywords = extractKeywords(resumeText || '');
  const matchedKeywordsList: string[] = [];
  const missingKeywordsList: string[] = [];

  for (const keyword of jdKeywords) {
    if (resumeKeywords.has(keyword)) {
      matchedKeywordsList.push(keyword);
    } else {
      missingKeywordsList.push(keyword);
    }
  }

  matchedKeywordsList.sort();
  missingKeywordsList.sort();

  const matchedCount = matchedKeywordsList.length;
  const matchPercentage = Math.round((matchedCount / totalKeywords) * 100);

  return {
    totalKeywords,
    matchedCount,
    matchCount: matchedCount,
    matchPercentage,
    matchedKeywords: matchedKeywordsList,
    missingKeywords: missingKeywordsList,
  };
}

/**
 * Losslessly splits text into segments, identifying words that match the keyword set.
 * Invariant: segments.map(s => s.text).join('') === text
 */
export function segmentTextByKeywords(
  text: string,
  keywords: Set<string>
): TextSegment[] {
  if (!text || typeof text !== 'string') return [];
  if (!keywords || keywords.size === 0) {
    return [{ text, isMatch: false }];
  }

  const segments: TextSegment[] = [];
  // Split retaining delimiters: words vs non-word delimiters (whitespace, punctuation)
  const parts = text.split(/([^a-zA-Z0-9-]+)/);

  for (const part of parts) {
    if (!part) continue;

    // Check if token consists of alphanumeric characters or hyphens
    const isWord = /^[a-zA-Z0-9-]+$/.test(part);

    if (isWord) {
      const cleanWord = part.toLowerCase().replace(/^-+|-+$/g, '');
      const isMatch = cleanWord.length > 0 && keywords.has(cleanWord);
      segments.push({ text: part, isMatch });
    } else {
      // Non-word separator (space, comma, semicolon, newline, etc.)
      segments.push({ text: part, isMatch: false });
    }
  }

  return segments;
}
