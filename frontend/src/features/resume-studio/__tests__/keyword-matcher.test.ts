import { describe, expect, it } from 'vitest';
import {
  calculateMatchStats,
  extractKeywords,
  segmentTextByKeywords,
  STOP_WORDS,
  MIN_WORD_LENGTH,
} from '../model/keyword-matcher';

describe('keyword-matcher model', () => {
  describe('extractKeywords', () => {
    it('lowercases and keeps significant technical words', () => {
      const kw = extractKeywords('Senior Python Engineer with FastAPI');
      expect(kw.has('python')).toBe(true);
      expect(kw.has('fastapi')).toBe(true);
      expect(kw.has('engineer')).toBe(true);
    });

    it('drops standard stop words and job-posting filler words', () => {
      const kw = extractKeywords(
        'the and with of role requirements responsibilities qualifications experience'
      );
      expect(kw.size).toBe(0);
    });

    it('drops words shorter than 3 characters', () => {
      const kw = extractKeywords('the and with of go ai ml');
      expect(kw.has('go')).toBe(false);
      expect(kw.has('ai')).toBe(false);
      expect(kw.has('ml')).toBe(false);
    });

    it('drops pure numbers but keeps alphanumeric tokens', () => {
      const kw = extractKeywords('5 years 2024 k8s ec2 html5 s3');
      expect(kw.has('5')).toBe(false);
      expect(kw.has('2024')).toBe(false);
      expect(kw.has('years')).toBe(false);
      expect(kw.has('k8s')).toBe(true);
      expect(kw.has('ec2')).toBe(true);
      expect(kw.has('html5')).toBe(true);
      expect(kw.has('s3')).toBe(false); // < 3 chars
    });

    it('strips leading and trailing hyphens from tokens', () => {
      const kw = extractKeywords('-fastapi- --docker-- -kubernetes');
      expect(kw.has('fastapi')).toBe(true);
      expect(kw.has('docker')).toBe(true);
      expect(kw.has('kubernetes')).toBe(true);
      expect(kw.has('-fastapi-')).toBe(false);
    });

    it('preserves internal hyphens in compound terms', () => {
      const kw = extractKeywords('front-end full-stack micro-services');
      expect(kw.has('front-end')).toBe(true);
      expect(kw.has('full-stack')).toBe(true);
      expect(kw.has('micro-services')).toBe(true);
    });

    it('deduplicates identical keywords regardless of casing', () => {
      const kw = extractKeywords('Docker docker DOCKER');
      expect([...kw]).toEqual(['docker']);
    });

    it('returns an empty set for empty or whitespace-only strings', () => {
      expect(extractKeywords('').size).toBe(0);
      expect(extractKeywords('   \t\n  ').size).toBe(0);
    });

    it('handles punctuation boundaries cleanly', () => {
      const kw = extractKeywords('FastAPI, Docker; Kubernetes! (GCP/AWS)');
      expect(kw.has('fastapi')).toBe(true);
      expect(kw.has('docker')).toBe(true);
      expect(kw.has('kubernetes')).toBe(true);
      expect(kw.has('gcp')).toBe(true);
      expect(kw.has('aws')).toBe(true);
    });

    it('handles non-string or falsy input gracefully without throwing', () => {
      // @ts-expect-error testing runtime robustness
      expect(extractKeywords(null).size).toBe(0);
      // @ts-expect-error testing runtime robustness
      expect(extractKeywords(undefined).size).toBe(0);
    });
  });

  describe('segmentTextByKeywords', () => {
    it('is completely lossless and preserves original text and spacing', () => {
      const text = 'Python, FastAPI, and Docker in 2024!';
      const segments = segmentTextByKeywords(text, new Set(['python', 'fastapi', 'docker']));
      expect(segments.map((s) => s.text).join('')).toBe(text);
    });

    it('preserves original casing while matching case-insensitively', () => {
      const segments = segmentTextByKeywords('Senior PYTHON Architect', new Set(['python']));
      const matched = segments.filter((s) => s.isMatch);
      expect(matched.length).toBe(1);
      expect(matched[0].text).toBe('PYTHON');
      expect(matched[0].isMatch).toBe(true);
    });

    it('handles text with no matching keywords', () => {
      const segments = segmentTextByKeywords('Vue and Nuxt', new Set(['react']));
      expect(segments.some((s) => s.isMatch)).toBe(false);
      expect(segments.map((s) => s.text).join('')).toBe('Vue and Nuxt');
    });

    it('returns a single non-matching segment when keywords set is empty', () => {
      const segments = segmentTextByKeywords('Python developer', new Set());
      expect(segments.length).toBe(1);
      expect(segments[0].text).toBe('Python developer');
      expect(segments[0].isMatch).toBe(false);
    });

    it('returns empty array when input text is empty', () => {
      expect(segmentTextByKeywords('', new Set(['python']))).toEqual([]);
    });

    it('correctly handles punctuation and brackets around matches', () => {
      const segments = segmentTextByKeywords('(Python, Docker)', new Set(['python', 'docker']));
      expect(segments.map((s) => s.text).join('')).toBe('(Python, Docker)');
      const matched = segments.filter((s) => s.isMatch).map((s) => s.text);
      expect(matched).toEqual(['Python', 'Docker']);
    });

    it('preserves multiline text formatting with tabs and newlines', () => {
      const multiline = '• Built APIs using FastAPI\n\t• Deployed with Docker & K8s';
      const segments = segmentTextByKeywords(multiline, new Set(['fastapi', 'docker', 'k8s']));
      expect(segments.map((s) => s.text).join('')).toBe(multiline);
      const matched = segments.filter((s) => s.isMatch).map((s) => s.text);
      expect(matched).toEqual(['FastAPI', 'Docker', 'K8s']);
    });

    it('handles adjacent matched keywords correctly', () => {
      const text = 'Docker Kubernetes';
      const segments = segmentTextByKeywords(text, new Set(['docker', 'kubernetes']));
      expect(segments).toEqual([
        { text: 'Docker', isMatch: true },
        { text: ' ', isMatch: false },
        { text: 'Kubernetes', isMatch: true },
      ]);
    });

    it('handles hyphenated boundary words in segmentation', () => {
      const text = '-Python- and full-stack';
      const segments = segmentTextByKeywords(text, new Set(['python', 'full-stack']));
      expect(segments.map((s) => s.text).join('')).toBe(text);
      const matched = segments.filter((s) => s.isMatch).map((s) => s.text);
      expect(matched).toEqual(['-Python-', 'full-stack']);
    });
  });

  describe('calculateMatchStats', () => {
    it('calculates partial match stats and rounds percentage correctly', () => {
      const resume = 'Built backend microservices using Python and FastAPI.';
      const jdKeywords = new Set(['python', 'fastapi', 'docker', 'kubernetes']);
      const stats = calculateMatchStats(resume, jdKeywords);

      expect(stats.totalKeywords).toBe(4);
      expect(stats.matchedCount).toBe(2);
      expect(stats.matchCount).toBe(2); // backward-compatible alias check
      expect(stats.matchPercentage).toBe(50);
      expect(stats.matchedKeywords).toEqual(['fastapi', 'python']);
      expect(stats.missingKeywords).toEqual(['docker', 'kubernetes']);
    });

    it('reports 100% when all JD keywords match', () => {
      const resume = 'Proficient in Docker and Kubernetes.';
      const jdKeywords = new Set(['docker', 'kubernetes']);
      const stats = calculateMatchStats(resume, jdKeywords);

      expect(stats.matchPercentage).toBe(100);
      expect(stats.matchedCount).toBe(2);
      expect(stats.missingKeywords).toEqual([]);
      expect(stats.matchedKeywords).toEqual(['docker', 'kubernetes']);
    });

    it('reports 0% without divide-by-zero when JD has no keywords', () => {
      const stats = calculateMatchStats('Python developer', new Set());
      expect(stats.totalKeywords).toBe(0);
      expect(stats.matchedCount).toBe(0);
      expect(stats.matchCount).toBe(0);
      expect(stats.matchPercentage).toBe(0);
      expect(stats.matchedKeywords).toEqual([]);
      expect(stats.missingKeywords).toEqual([]);
    });

    it('reports 0% when resume text is empty', () => {
      const jdKeywords = new Set(['react', 'typescript']);
      const stats = calculateMatchStats('', jdKeywords);
      expect(stats.totalKeywords).toBe(2);
      expect(stats.matchedCount).toBe(0);
      expect(stats.matchPercentage).toBe(0);
      expect(stats.matchedKeywords).toEqual([]);
      expect(stats.missingKeywords).toEqual(['react', 'typescript']);
    });

    it('rounds percentage to nearest integer correctly', () => {
      // 1 out of 3 = 33.333% -> 33%
      const stats33 = calculateMatchStats('Python', new Set(['python', 'docker', 'aws']));
      expect(stats33.matchPercentage).toBe(33);

      // 2 out of 3 = 66.666% -> 67%
      const stats67 = calculateMatchStats('Python Docker', new Set(['python', 'docker', 'aws']));
      expect(stats67.matchPercentage).toBe(67);
    });

    it('ensures matchedKeywords and missingKeywords are sorted alphabetically', () => {
      const resume = 'Zookeeper Kafka Ansible';
      const jdKeywords = new Set(['zookeeper', 'ansible', 'kafka', 'docker']);
      const stats = calculateMatchStats(resume, jdKeywords);
      expect(stats.matchedKeywords).toEqual(['ansible', 'kafka', 'zookeeper']);
      expect(stats.missingKeywords).toEqual(['docker']);
    });

    it('handles completely disjoint keyword sets (0% match)', () => {
      const resume = 'Vue Nuxt Svelte';
      const jdKeywords = new Set(['angular', 'react']);
      const stats = calculateMatchStats(resume, jdKeywords);
      expect(stats.totalKeywords).toBe(2);
      expect(stats.matchedCount).toBe(0);
      expect(stats.matchPercentage).toBe(0);
      expect(stats.matchedKeywords).toEqual([]);
      expect(stats.missingKeywords).toEqual(['angular', 'react']);
    });

    it('performs case-insensitive matching between resume and JD', () => {
      const resume = 'EXPERIENCE WITH DOCKER, KUBERNETES, AND TERRAFORM';
      const jdKeywords = new Set(['docker', 'kubernetes', 'terraform']);
      const stats = calculateMatchStats(resume, jdKeywords);
      expect(stats.matchedCount).toBe(3);
      expect(stats.matchPercentage).toBe(100);
      expect(stats.matchedKeywords).toEqual(['docker', 'kubernetes', 'terraform']);
    });
  });

  describe('STOP_WORDS and constants', () => {
    it('defines MIN_WORD_LENGTH as 3', () => {
      expect(MIN_WORD_LENGTH).toBe(3);
    });

    it('contains at least 160 unique stop words (comprehensive taxonomy >= 214)', () => {
      expect(STOP_WORDS.size).toBeGreaterThanOrEqual(160);
      expect(STOP_WORDS.size).toBeGreaterThanOrEqual(214);
    });

    it('does not contain vital technical keywords', () => {
      const techWords = ['python', 'docker', 'react', 'sql', 'aws', 'fastapi', 'k8s', 'terraform', 'graphql'];
      for (const word of techWords) {
        expect(STOP_WORDS.has(word)).toBe(false);
      }
    });

    it('contains key recruiting boilerplate and job filler words', () => {
      const boilerplate = ['role', 'roles', 'position', 'requirements', 'responsibilities', 'qualifications', 'experience', 'skills'];
      for (const word of boilerplate) {
        expect(STOP_WORDS.has(word)).toBe(true);
      }
    });
  });
});
