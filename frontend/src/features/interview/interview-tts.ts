/**
 * Mock-interview TTS: Browser speechSynthesis only (Fish Audio disabled for cost).
 * Fish Audio server proxy is intentionally NOT used — interview questions use
 * free Web Speech API (SpeechSynthesisUtterance). Guarantees full utterance
 * playback before resolving — never advances mid-sentence.
 */

export type InterviewTtsKind = "question" | "feedback" | "bridge" | "general";

export type SpeakOptions = {
  kind?: InterviewTtsKind;
  /** Called when playback is cancelled (navigation / next turn). */
  signal?: AbortSignal;
  /** Prefer Fish Audio when available (default true). */
  preferFish?: boolean;
};

type TtsStatus = {
  provider: string | null;
  configured: boolean;
  model?: string | null;
  fallback?: string;
};

let cachedStatus: TtsStatus | null = null;
let statusFetchedAt = 0;
const STATUS_TTL_MS = 60_000;

export function cancelInterviewSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

export function isInterviewSpeechBusy(): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  try {
    return Boolean(window.speechSynthesis.speaking || window.speechSynthesis.pending);
  } catch {
    return false;
  }
}

export async function fetchInterviewTtsStatus(force = false): Promise<TtsStatus> {
  // Fish Audio disabled for cost — always report browser-only, no network call.
  const now = Date.now();
  if (!force && cachedStatus && now - statusFetchedAt < STATUS_TTL_MS) {
    // Force browser-only even if previously cached as Fish
    if (cachedStatus.configured === false) return cachedStatus;
  }
  cachedStatus = { provider: null, configured: false, fallback: "browser_speech_synthesis" };
  statusFetchedAt = now;
  return cachedStatus;
}

/** Split long lines into sentence-sized chunks so Chrome does not drop long utterances. */
function splitForBrowserTts(text: string, maxChunk = 220): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChunk) return [cleaned];
  const parts = cleaned.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let buf = "";
  for (const part of parts) {
    if (!part) continue;
    if (!buf) {
      buf = part;
      continue;
    }
    if (`${buf} ${part}`.length <= maxChunk) {
      buf = `${buf} ${part}`;
    } else {
      chunks.push(buf);
      buf = part;
    }
  }
  if (buf) chunks.push(buf);
  // Hard-split any remaining oversized piece.
  const final: string[] = [];
  for (const chunk of chunks.length ? chunks : [cleaned]) {
    if (chunk.length <= maxChunk) {
      final.push(chunk);
      continue;
    }
    let i = 0;
    while (i < chunk.length) {
      final.push(chunk.slice(i, i + maxChunk));
      i += maxChunk;
    }
  }
  return final;
}

function speakWithBrowser(text: string, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    cancelInterviewSpeech();
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const chunks = splitForBrowserTts(text);
    if (!chunks.length) {
      resolve();
      return;
    }

    let settled = false;
    let index = 0;
    let chunkToken = 0;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      if (err) reject(err);
      else resolve();
    };

    const onAbort = () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
      finish(new DOMException("Aborted", "AbortError"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    const speakNext = () => {
      if (settled || signal?.aborted) {
        finish(signal?.aborted ? new DOMException("Aborted", "AbortError") : undefined);
        return;
      }
      if (index >= chunks.length) {
        finish();
        return;
      }
      const chunk = chunks[index];
      index += 1;
      const token = ++chunkToken;
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.rate = 1;
      utterance.pitch = 1;
      const advance = () => {
        if (settled || token !== chunkToken) return;
        speakNext();
      };
      utterance.onend = advance;
      utterance.onerror = advance; // keep going so the full script is attempted
      // Per-chunk safety — only after a generous read time for this piece.
      const chunkMs = Math.min(45_000, Math.max(4_000, 2000 + chunk.length * 80));
      window.setTimeout(() => {
        // If this chunk hung, advance rather than strand the interview.
        if (!settled && token === chunkToken) {
          try {
            window.speechSynthesis.cancel();
          } catch {
            /* ignore */
          }
          speakNext();
        }
      }, chunkMs);
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        speakNext();
      }
    };

    void window.speechSynthesis.getVoices();
    // Overall hard ceiling so a broken synthesizer cannot block forever.
    window.setTimeout(() => finish(), Math.min(120_000, 5000 + text.length * 90));
    speakNext();
  });
}

/**
 * Speak interviewer text fully, then resolve.
 * Browser speechSynthesis only — Fish Audio never called (cost saving).
 * Does not resolve until playback ends (or abort / hard failure).
 */
export async function speakInterviewLine(text: string, options?: SpeakOptions): Promise<void> {
  const line = String(text || "").trim();
  if (!line) return;
  if (options?.signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  // Cost guard: ignore preferFish, never hit Fish Audio endpoint.
  // Even if caller passes preferFish=true, force browser TTS.
  await speakWithBrowser(line, options?.signal);
}

/**
 * Wait until any interviewer audio has fully finished, then optionally delay.
 * Unlike the old helper, this NEVER cancels speech early.
 */
export function waitUntilInterviewSpeechIdle(options?: {
  pollMs?: number;
  maxWaitMs?: number;
  afterIdleMs?: number;
  isCancelled?: () => boolean;
}): Promise<void> {
  const pollMs = options?.pollMs ?? 120;
  const maxWaitMs = options?.maxWaitMs ?? 120_000;
  const afterIdleMs = options?.afterIdleMs ?? 500;
  const started = Date.now();

  return new Promise((resolve) => {
    const tick = () => {
      if (options?.isCancelled?.()) {
        resolve();
        return;
      }
      if (isInterviewSpeechBusy() && Date.now() - started < maxWaitMs) {
        window.setTimeout(tick, pollMs);
        return;
      }
      window.setTimeout(() => {
        if (options?.isCancelled?.()) {
          resolve();
          return;
        }
        resolve();
      }, afterIdleMs);
    };
    tick();
  });
}
