import { describe, expect, it } from 'vitest';
import {
  calculateMatchStats,
  extractKeywords,
  segmentTextByKeywords,
  STOP_WORDS,
} from '../model/keyword-matcher';

describe('keyword-matcher adversarial & empirical stress suite', () => {
  // =========================================================================
  // 1. EMPTY STRINGS, WHITESPACE-ONLY, PURE STOP WORDS, AND NULLISH INPUTS
  // =========================================================================
  describe('1. Empty strings, whitespace-only, and pure stop words', () => {
    it('returns empty set for empty string', () => {
      expect(extractKeywords('').size).toBe(0);
    });

    it('returns empty set for whitespace-only strings containing spaces, tabs, newlines, and form feeds', () => {
      expect(extractKeywords('   ').size).toBe(0);
      expect(extractKeywords('\t\r\n\v\f').size).toBe(0);
      expect(extractKeywords('  \t \n \r  \v \f  ').size).toBe(0);
    });

    it('returns empty set when text consists purely of standard stop words', () => {
      const pureStopWords = Array.from(STOP_WORDS).slice(0, 50).join(' ');
      const extracted = extractKeywords(pureStopWords);
      expect(extracted.size).toBe(0);
    });

    it('returns empty set when text consists purely of recruiting filler words', () => {
      const recruitingFiller =
        'role roles position positions job jobs work works working team teams ' +
        'company companies looking seeking required requires requirement requirements ' +
        'responsibility responsibilities qualification qualifications preferred ' +
        'experience experiences experienced year years ability abilities skill skills ' +
        'knowledge strong excellent good great include includes including etc';
      const extracted = extractKeywords(recruitingFiller);
      expect(extracted.size).toBe(0);
    });

    it('filters out words below MIN_WORD_LENGTH (3 characters)', () => {
      const shortWords = 'a ab cd ef go to in on at it is do we he or if an as by';
      expect(extractKeywords(shortWords).size).toBe(0);
    });

    it('filters out pure numeric tokens across various magnitudes', () => {
      const numbers = '0 1 23 456 7890 12345 1000000 99999999999';
      expect(extractKeywords(numbers).size).toBe(0);
    });

    it('handles non-string / nullish inputs safely without throwing exceptions', () => {
      // @ts-expect-error testing adversarial runtime inputs
      expect(extractKeywords(null).size).toBe(0);
      // @ts-expect-error testing adversarial runtime inputs
      expect(extractKeywords(undefined).size).toBe(0);
      // @ts-expect-error testing adversarial runtime inputs
      expect(extractKeywords(42).size).toBe(0);
      // @ts-expect-error testing adversarial runtime inputs
      expect(extractKeywords({}).size).toBe(0);
      // @ts-expect-error testing adversarial runtime inputs
      expect(extractKeywords([]).size).toBe(0);
    });

    it('handles calculateMatchStats with empty or nullish inputs', () => {
      // Empty string and empty keywords
      const stats1 = calculateMatchStats('', new Set());
      expect(stats1.totalKeywords).toBe(0);
      expect(stats1.matchedCount).toBe(0);
      expect(stats1.matchCount).toBe(0);
      expect(stats1.matchPercentage).toBe(0);
      expect(stats1.matchedKeywords).toEqual([]);
      expect(stats1.missingKeywords).toEqual([]);

      // Whitespace resume and empty keywords
      const stats2 = calculateMatchStats('   \n\t  ', new Set());
      expect(stats2.matchPercentage).toBe(0);
      expect(stats2.totalKeywords).toBe(0);

      // Pure stop words resume with non-empty keywords
      const stats3 = calculateMatchStats(
        'the and with for of experience requirements',
        new Set(['python', 'docker'])
      );
      expect(stats3.totalKeywords).toBe(2);
      expect(stats3.matchedCount).toBe(0);
      expect(stats3.matchCount).toBe(0);
      expect(stats3.matchPercentage).toBe(0);
      expect(stats3.missingKeywords).toEqual(['docker', 'python']);
      expect(stats3.matchedKeywords).toEqual([]);

      // Nullish inputs
      // @ts-expect-error testing adversarial runtime inputs
      const stats4 = calculateMatchStats(null, new Set(['python']));
      expect(stats4.matchedCount).toBe(0);
      expect(stats4.matchPercentage).toBe(0);
      expect(stats4.missingKeywords).toEqual(['python']);

      // @ts-expect-error testing adversarial runtime inputs
      const stats5 = calculateMatchStats('Python developer', null);
      expect(stats5.totalKeywords).toBe(0);
      expect(stats5.matchPercentage).toBe(0);
    });

    it('handles segmentTextByKeywords with empty or nullish inputs losslessly', () => {
      expect(segmentTextByKeywords('', new Set())).toEqual([]);
      expect(segmentTextByKeywords('', new Set(['python']))).toEqual([]);

      // @ts-expect-error testing adversarial runtime inputs
      expect(segmentTextByKeywords(null, new Set(['python']))).toEqual([]);
      // @ts-expect-error testing adversarial runtime inputs
      expect(segmentTextByKeywords(undefined, new Set())).toEqual([]);

      const whitespaceText = '   \t\n  ';
      const wsSegments = segmentTextByKeywords(whitespaceText, new Set(['python']));
      expect(wsSegments.map((s) => s.text).join('')).toBe(whitespaceText);
      expect(wsSegments.some((s) => s.isMatch)).toBe(false);
    });
  });

  // =========================================================================
  // 2. EXTREME SCALE, 10,000 WORDS, REPEATED TERMS, AND EXTREME HYPHENS
  // =========================================================================
  describe('2. Extreme scale, 10,000 words, repeated terms, and extreme hyphens', () => {
    it('processes a 10,000-word document efficiently without stack overflow or performance degradation', () => {
      const vocab = [
        'python', 'fastapi', 'docker', 'kubernetes', 'typescript',
        'react', 'postgres', 'redis', 'graphql', 'terraform',
        'the', 'and', 'with', 'experience', 'requirements',
        '100', '2024', 'scalable', 'cloud-native', 'microservices',
      ];
      // Generate exactly 10,000 words
      const words: string[] = [];
      for (let i = 0; i < 10000; i++) {
        words.push(vocab[i % vocab.length]);
      }
      const massiveText = words.join(' ');

      const start = performance.now();
      const extracted = extractKeywords(massiveText);
      const extractDuration = performance.now() - start;

      // Ensure extraction executes in under 150ms
      expect(extractDuration).toBeLessThan(150);

      // Verify correct extraction and deduplication
      expect(extracted.has('python')).toBe(true);
      expect(extracted.has('fastapi')).toBe(true);
      expect(extracted.has('cloud-native')).toBe(true);
      expect(extracted.has('the')).toBe(false);
      expect(extracted.has('100')).toBe(false);

      // Verify calculateMatchStats on 10,000 words
      const statsStart = performance.now();
      const stats = calculateMatchStats(massiveText, new Set(['python', 'docker', 'aws', 'golang']));
      const statsDuration = performance.now() - statsStart;
      expect(statsDuration).toBeLessThan(100);
      expect(stats.matchedCount).toBe(2); // python and docker
      expect(stats.totalKeywords).toBe(4);
      expect(stats.matchPercentage).toBe(50);
      expect(stats.matchedKeywords).toEqual(['docker', 'python']);
      expect(stats.missingKeywords).toEqual(['aws', 'golang']);

      // Verify segmentTextByKeywords strict lossless invariant on 10,000 words
      const segmentStart = performance.now();
      const segments = segmentTextByKeywords(massiveText, new Set(['python', 'docker']));
      const segmentDuration = performance.now() - segmentStart;
      expect(segmentDuration).toBeLessThan(150);

      // Lossless reconstruction check
      const reconstructed = segments.map((s) => s.text).join('');
      expect(reconstructed).toBe(massiveText);
      expect(reconstructed.length).toBe(massiveText.length);
    });

    it('handles identical keyword repeated 10,000 times cleanly', () => {
      const repeatedWord = 'docker '.repeat(10000).trim();
      const extracted = extractKeywords(repeatedWord);
      expect(extracted.size).toBe(1);
      expect(extracted.has('docker')).toBe(true);

      const stats = calculateMatchStats(repeatedWord, new Set(['docker', 'kubernetes']));
      expect(stats.totalKeywords).toBe(2);
      expect(stats.matchedCount).toBe(1);
      expect(stats.matchPercentage).toBe(50);
      expect(stats.matchedKeywords).toEqual(['docker']);
      expect(stats.missingKeywords).toEqual(['kubernetes']);

      const segments = segmentTextByKeywords(repeatedWord, new Set(['docker']));
      expect(segments.map((s) => s.text).join('')).toBe(repeatedWord);
      // All docker segments should be matched
      const matchedSegments = segments.filter((s) => s.isMatch);
      expect(matchedSegments.length).toBe(10000);
      expect(matchedSegments.every((s) => s.text === 'docker')).toBe(true);
    });

    it('handles extreme hyphen boundary patterns correctly', () => {
      // 1. Triple hyphens on both ends
      const text1 = '---test---';
      const kw1 = extractKeywords(text1);
      expect(kw1.has('test')).toBe(true);
      expect(kw1.size).toBe(1);

      // 2. Pure hyphens of length 1,000
      const pureHyphens = '-'.repeat(1000);
      expect(extractKeywords(pureHyphens).size).toBe(0);

      // 3. Short single token wrapped in hyphens (< MIN_WORD_LENGTH after stripping)
      expect(extractKeywords('---a---').size).toBe(0);
      expect(extractKeywords('---ab---').size).toBe(0);
      expect(extractKeywords('--12--').size).toBe(0);

      // 4. Keyword surrounded by 500 hyphens on each side
      const heavyHyphens = '-'.repeat(500) + 'fastapi' + '-'.repeat(500);
      const kw3 = extractKeywords(heavyHyphens);
      expect(kw3.has('fastapi')).toBe(true);
      expect(kw3.size).toBe(1);

      // 5. Internal multi-hyphen compound terms are preserved
      const compound = '---foo---bar---';
      const kw5 = extractKeywords(compound);
      expect(kw5.has('foo---bar')).toBe(true);

      // 6. Lossless segmentation with extreme hyphens
      const hyphenTestText = `${pureHyphens} and ${heavyHyphens} and normal-term`;
      const segments = segmentTextByKeywords(
        hyphenTestText,
        new Set(['fastapi', 'normal-term'])
      );
      expect(segments.map((s) => s.text).join('')).toBe(hyphenTestText);
      const matched = segments.filter((s) => s.isMatch).map((s) => s.text);
      expect(matched).toEqual([heavyHyphens, 'normal-term']);
    });
  });

  // =========================================================================
  // 3. UNICODE, EMOJIS, FOREIGN SCRIPTS, CONTROL CHARACTERS, AND NEWLINES
  // =========================================================================
  describe('3. Unicode, emojis, foreign scripts, control characters, and newlines', () => {
    it('handles modern emojis and technical symbols with strict lossless segmentation', () => {
      const emojiText = '🚀 Python 🐍 FastAPI 🔥 Docker 💻 TypeScript ⚡ K8s';
      const kw = extractKeywords(emojiText);

      expect(kw.has('python')).toBe(true);
      expect(kw.has('fastapi')).toBe(true);
      expect(kw.has('docker')).toBe(true);
      expect(kw.has('typescript')).toBe(true);
      expect(kw.has('k8s')).toBe(true);

      const segments = segmentTextByKeywords(
        emojiText,
        new Set(['python', 'fastapi', 'docker', 'typescript', 'k8s'])
      );
      expect(segments.map((s) => s.text).join('')).toBe(emojiText);

      const matchedTexts = segments.filter((s) => s.isMatch).map((s) => s.text);
      expect(matchedTexts).toEqual(['Python', 'FastAPI', 'Docker', 'TypeScript', 'K8s']);
    });

    it('handles complex multi-codepoint emojis (ZWJ sequences, skin tones, flags)', () => {
      const complexEmoji = '👩🏽‍💻 Senior Python Engineer 👨‍👩‍👧‍👦 with Docker 🏳️‍🌈 in Cloud';
      const segments = segmentTextByKeywords(
        complexEmoji,
        new Set(['python', 'engineer', 'docker', 'cloud'])
      );
      expect(segments.map((s) => s.text).join('')).toBe(complexEmoji);
      const matched = segments.filter((s) => s.isMatch).map((s) => s.text);
      expect(matched).toEqual(['Python', 'Engineer', 'Docker', 'Cloud']);
    });

    it('handles foreign scripts without errors and maintains lossless reconstruction', () => {
      // Cyrillic
      const cyrillic = 'Ведущий разработчик Python и Docker в Санкт-Петербурге';
      expect(segmentTextByKeywords(cyrillic, new Set(['python', 'docker'])).map((s) => s.text).join('')).toBe(cyrillic);
      expect(extractKeywords(cyrillic).has('python')).toBe(true);
      expect(extractKeywords(cyrillic).has('docker')).toBe(true);

      // Chinese / Japanese (CJK)
      const cjk = '熟练掌握 Python、Docker 与 Kubernetes 架构设计';
      expect(segmentTextByKeywords(cjk, new Set(['python', 'docker', 'kubernetes'])).map((s) => s.text).join('')).toBe(cjk);
      const cjkKw = extractKeywords(cjk);
      expect(cjkKw.has('python')).toBe(true);
      expect(cjkKw.has('docker')).toBe(true);
      expect(cjkKw.has('kubernetes')).toBe(true);

      // Arabic
      const arabic = 'مهندس برمجيات متقدم Python و Docker';
      expect(segmentTextByKeywords(arabic, new Set(['python', 'docker'])).map((s) => s.text).join('')).toBe(arabic);

      // Devanagari
      const devanagari = 'पायथन (Python) और डॉकर (Docker) विशेषज्ञ';
      expect(segmentTextByKeywords(devanagari, new Set(['python', 'docker'])).map((s) => s.text).join('')).toBe(devanagari);
    });

    it('handles control characters and invisible unicode characters losslessly', () => {
      // Null byte \x00, bell \x07, backspace \x08, vertical tab \x0b, escape \x1b
      const controlChars = '\x00\x01\x02Python\x07\x08 \x0bDocker\x1b\x1f';
      const segments = segmentTextByKeywords(controlChars, new Set(['python', 'docker']));
      expect(segments.map((s) => s.text).join('')).toBe(controlChars);

      // Zero-width space (\u200B), non-breaking space (\u00A0), BOM (\uFEFF)
      const specialWhitespace = '\uFEFFPython\u200B \u00A0Docker\u200D';
      const specialSegments = segmentTextByKeywords(specialWhitespace, new Set(['python', 'docker']));
      expect(specialSegments.map((s) => s.text).join('')).toBe(specialWhitespace);
    });

    it('preserves diverse newline styles (Windows CRLF, Unix LF, Mac CR) and tab indentations', () => {
      const mixedNewlines =
        'Experience Summary:\r\n' +
        '\t• Architecture with Python\n' +
        '\t\t- Microservices via FastAPI\r' +
        '\t• Container orchestration: Docker & K8s\r\n\r\n' +
        'End of Section.\n';

      const segments = segmentTextByKeywords(
        mixedNewlines,
        new Set(['python', 'fastapi', 'docker', 'k8s'])
      );
      expect(segments.map((s) => s.text).join('')).toBe(mixedNewlines);

      const matched = segments.filter((s) => s.isMatch).map((s) => s.text);
      expect(matched).toEqual(['Python', 'FastAPI', 'Docker', 'K8s']);
    });
  });

  // =========================================================================
  // 4. NUMERICAL SAFETY: NO NaN, NEGATIVE PERCENTAGES, OR DIVIDE-BY-ZERO
  // =========================================================================
  describe('4. Numerical safety and boundary verification for calculateMatchStats', () => {
    it('never produces NaN or Infinity on empty keyword set (divide-by-zero protection)', () => {
      const stats = calculateMatchStats('Python Docker React TypeScript', new Set());
      expect(stats.totalKeywords).toBe(0);
      expect(stats.matchedCount).toBe(0);
      expect(stats.matchCount).toBe(0);
      expect(stats.matchPercentage).toBe(0);
      expect(Number.isNaN(stats.matchPercentage)).toBe(false);
      expect(Number.isFinite(stats.matchPercentage)).toBe(true);
      expect(Object.is(stats.matchPercentage, -0)).toBe(false);
    });

    it('never produces negative percentages under any input condition', () => {
      const testCases = [
        { resume: '', keywords: new Set<string>() },
        { resume: '', keywords: new Set(['python']) },
        { resume: 'unrelated text', keywords: new Set(['python', 'docker']) },
        { resume: 'python', keywords: new Set(['python']) },
      ];

      for (const tc of testCases) {
        const stats = calculateMatchStats(tc.resume, tc.keywords);
        expect(stats.matchPercentage).toBeGreaterThanOrEqual(0);
        expect(stats.matchPercentage).toBeLessThanOrEqual(100);
        expect(Number.isNaN(stats.matchPercentage)).toBe(false);
      }
    });

    it('accurately computes edge fraction percentages with correct standard rounding', () => {
      // 1 out of 3 = 33.333% -> 33%
      expect(calculateMatchStats('kwalpha', new Set(['kwalpha', 'kwbeta', 'kwgamma'])).matchPercentage).toBe(33);
      // 2 out of 3 = 66.667% -> 67%
      expect(calculateMatchStats('kwalpha kwbeta', new Set(['kwalpha', 'kwbeta', 'kwgamma'])).matchPercentage).toBe(67);
      // 1 out of 6 = 16.667% -> 17%
      expect(calculateMatchStats('kwalpha', new Set(['kwalpha', 'kwbeta', 'kwgamma', 'kwdelta', 'kwepsilon', 'kwzeta'])).matchPercentage).toBe(17);
      // 5 out of 6 = 83.333% -> 83%
      expect(calculateMatchStats('kwalpha kwbeta kwgamma kwdelta kwepsilon', new Set(['kwalpha', 'kwbeta', 'kwgamma', 'kwdelta', 'kwepsilon', 'kwzeta'])).matchPercentage).toBe(83);
      // 1 out of 7 = 14.2857% -> 14%
      expect(calculateMatchStats('kwalpha', new Set(['kwalpha', 'kwbeta', 'kwgamma', 'kwdelta', 'kwepsilon', 'kwzeta', 'kweta'])).matchPercentage).toBe(14);
      // 0 out of 100 -> 0%
      const hundredSet = new Set(Array.from({ length: 100 }, (_, i) => `term${i + 100}`));
      expect(calculateMatchStats('', hundredSet).matchPercentage).toBe(0);
      // 100 out of 100 -> 100%
      const allHundred = Array.from({ length: 100 }, (_, i) => `term${i + 100}`).join(' ');
      expect(calculateMatchStats(allHundred, hundredSet).matchPercentage).toBe(100);
    });

    it('rigorously satisfies mathematical invariants across all permutations from N=1 to N=250', () => {
      // Test 16 distinct keyword set sizes
      const setSizes = [1, 2, 3, 4, 5, 7, 10, 13, 17, 25, 50, 75, 100, 150, 200, 250];

      for (const total of setSizes) {
        const jdList = Array.from({ length: total }, (_, i) => `kwterm${i + 1000}`);
        const jdSet = new Set(jdList);

        // Test matched count at 0, 1, half, and all
        const matchCountsToTest = [0, 1, Math.floor(total / 2), total];

        for (const matchedTarget of matchCountsToTest) {
          const matchedSubset = jdList.slice(0, matchedTarget);
          const resumeText = matchedSubset.join(' ');

          const stats = calculateMatchStats(resumeText, jdSet);

          // Invariant 1: Total matches input set size
          expect(stats.totalKeywords).toBe(total);
          // Invariant 2: Matched count matches target
          expect(stats.matchedCount).toBe(matchedTarget);
          expect(stats.matchCount).toBe(matchedTarget);
          // Invariant 3: Missing count equals total - matched
          expect(stats.missingKeywords.length).toBe(total - matchedTarget);
          // Invariant 4: Matched count + missing count === total
          expect(stats.matchedKeywords.length + stats.missingKeywords.length).toBe(total);
          // Invariant 5: Match percentage is valid integer between 0 and 100
          expect(Number.isInteger(stats.matchPercentage)).toBe(true);
          expect(stats.matchPercentage).toBeGreaterThanOrEqual(0);
          expect(stats.matchPercentage).toBeLessThanOrEqual(100);
          expect(Number.isNaN(stats.matchPercentage)).toBe(false);
          expect(Number.isFinite(stats.matchPercentage)).toBe(true);
          // Invariant 6: Percentage equals rounded ratio
          const expectedPct = Math.round((matchedTarget / total) * 100);
          expect(stats.matchPercentage).toBe(expectedPct);
        }
      }
    });
  });

  // =========================================================================
  // 5. LOSSLESS TEXT RECONSTRUCTION INVARIANT & PROPERTY FUZZING
  // =========================================================================
  describe('5. Lossless text reconstruction invariant: segments.map(s => s.text).join("") === input', () => {
    it('maintains strict lossless reconstruction across 200 randomized adversarial fuzz strings', () => {
      const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const delimiters = [' ', '  ', '\t', '\n', '\r\n', '-', '--', '---', ', ', '; ', ': ', '!', '?', '(', ')', '[', ']', '{', '}', '/', '\\', ' | '];
      const emojis = ['🚀', '🔥', '💻', '🐍', '⚡', '✨', '🎯', '🛠️', '📊', '📈'];
      const techTokens = ['python', 'docker', 'fastapi', 'kubernetes', 'typescript', 'react', 'postgres', 'aws', 'gcp', 'redis'];
      const keywordsSet = new Set(['python', 'docker', 'fastapi', 'kubernetes', 'typescript', 'react']);

      // Pseudo-random deterministic generator (LCG)
      let seed = 424242;
      function random(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      function pick<T>(arr: T[]): T {
        return arr[Math.floor(random() * arr.length)];
      }

      for (let iteration = 0; iteration < 200; iteration++) {
        const numTokens = 5 + Math.floor(random() * 25);
        let constructedText = '';

        for (let t = 0; t < numTokens; t++) {
          const type = random();
          if (type < 0.3) {
            // Pick a tech token (maybe uppercase or mixed case)
            const token = pick(techTokens);
            constructedText += random() > 0.5 ? token.toUpperCase() : token;
          } else if (type < 0.5) {
            // Pick a random alphanumeric word of length 1 to 10
            const len = 1 + Math.floor(random() * 10);
            let word = '';
            for (let c = 0; c < len; c++) {
              word += alphabet[Math.floor(random() * alphabet.length)];
            }
            constructedText += word;
          } else if (type < 0.7) {
            // Pick an emoji
            constructedText += pick(emojis);
          } else {
            // Pick random hyphens or symbols
            constructedText += '-'.repeat(1 + Math.floor(random() * 5));
          }

          // Add a random delimiter
          constructedText += pick(delimiters);
        }

        const segments = segmentTextByKeywords(constructedText, keywordsSet);

        // 1. Lossless string equality invariant
        const joined = segments.map((s) => s.text).join('');
        expect(joined).toBe(constructedText);

        // 2. Length equality invariant
        expect(joined.length).toBe(constructedText.length);

        // 3. No segment should have empty text
        for (const seg of segments) {
          expect(seg.text.length).toBeGreaterThan(0);
        }
      }
    });

    it('verifies single character inputs and boundary symbols', () => {
      const singleChars = ['-', 'a', 'Z', '1', ' ', '\n', '\t', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '🚀'];
      const testKeywords = new Set(['python', 'a']);

      for (const char of singleChars) {
        const segments = segmentTextByKeywords(char, testKeywords);
        expect(segments.map((s) => s.text).join('')).toBe(char);
      }
    });

    it('verifies regex metacharacters in input text do not corrupt segmentation or matching', () => {
      const regexMetachars = 'C++ .NET Node.js [regex] (group) {count} ^start $end *star +plus ?optional |pipe \\slash';
      const testKeywords = new Set(['node', 'net', 'group', 'start', 'pipe']);

      const segments = segmentTextByKeywords(regexMetachars, testKeywords);
      expect(segments.map((s) => s.text).join('')).toBe(regexMetachars);

      const matched = segments.filter((s) => s.isMatch).map((s) => s.text);
      expect(matched).toContain('Node');
      expect(matched).toContain('NET');
      expect(matched).toContain('group');
      expect(matched).toContain('start');
      expect(matched).toContain('pipe');
    });

    it('prevents substring contamination (e.g. "java" matching inside "javascript")', () => {
      const text = 'Proficient in Java, JavaScript, TypeScript, and Reactive programming.';
      const keywords = new Set(['java', 'script', 'react']);

      const segments = segmentTextByKeywords(text, keywords);
      expect(segments.map((s) => s.text).join('')).toBe(text);

      const matched = segments.filter((s) => s.isMatch).map((s) => s.text);
      // 'Java' matches 'java'
      expect(matched).toContain('Java');
      // 'JavaScript' must NOT match 'java' or 'script' because it is a distinct full token
      expect(matched).not.toContain('JavaScript');
      // 'Reactive' must NOT match 'react'
      expect(matched).not.toContain('Reactive');
    });
  });
});
