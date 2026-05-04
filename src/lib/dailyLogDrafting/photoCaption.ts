// ── Photo auto-captioning ──────────────────────────────────────────────────
// Batches all uncaptioned photos for a day into a single Anthropic vision
// call. Returns captions paired with input ids; missing ones are silently
// dropped (the section assembler treats them as optional).
//
// Why one batch call: vision tokens are expensive and the per-call latency
// dominates total time. A single Sonnet call with N images returns N
// captions in roughly the same wall-clock as 1 image. We batch up to 20
// per call to stay under context limits; larger sets are chunked.
//
// Why Sonnet (not Haiku): construction-site photos contain trade-specific
// detail (e.g. "rebar mat installed in pier 7" vs "men working with metal
// rods"). Haiku captions are too generic and frequently hallucinate; the
// 3× cost is worth the accuracy.
//
// PII guard: prompt forbids identifying individuals by name or face.
// Captions are post-processed to strip names that look like full names
// even if the model emits them.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const BATCH_SIZE = 20;
const MAX_CAPTION_WORDS = 12;

export interface PhotoToCaption {
  id: string;
  /** Public URL for the model to read. Caller is responsible for ensuring
   *  the URL is reachable (signed URL or public bucket). */
  url: string;
}

export interface CaptionResult {
  id: string;
  caption: string;
}

const SYSTEM_PROMPT_CACHEABLE = `You are a construction-site photographer's assistant. You write factual, six-to-twelve-word captions for jobsite photos. Each caption describes the visible work — materials, trade, location cues — without naming any individuals, without speculation about who is in the photo, and without commentary.

Rules:
- 6 to 12 words per caption.
- Use construction-trade nouns: "rebar mat", "CMU lift", "MEP rough-in", "drywall taping".
- Never use a person's name; never say "worker named X".
- If the photo shows people, refer to them by trade ("two electricians", "ironworker") or quantity only.
- Never speculate about quality, safety, or compliance ("looks unsafe", "OSHA violation"). State only what's visible.
- If you cannot identify any construction activity, output exactly "no construction activity visible".
- Output one caption per image, in the order received, separated by exactly one newline.
- Output nothing else — no numbering, no preface, no commentary.`;

/** Strip likely full-name patterns from a caption.
 *  Conservative: only matches Title Case First Last with no other words. */
function stripPii(caption: string): string {
  return caption
    .replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, '<redacted>')
    .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '<redacted>')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '<redacted>');
}

function clipWords(s: string, max: number): string {
  const words = s.trim().split(/\s+/);
  if (words.length <= max) return s.trim();
  return words.slice(0, max).join(' ') + '…';
}

async function callOnce(
  apiKey: string,
  batch: ReadonlyArray<PhotoToCaption>,
  signal?: AbortSignal,
): Promise<ReadonlyArray<CaptionResult>> {
  const content = [
    { type: 'text' as const, text: `Caption these ${batch.length} construction-site photo(s):` },
    ...batch.map((p) => ({
      type: 'image' as const,
      source: { type: 'url' as const, url: p.url },
    })),
  ];

  const body = {
    model: MODEL,
    max_tokens: 60 * batch.length,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT_CACHEABLE,
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [{ role: 'user', content }],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Anthropic vision call failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const text = (data?.content?.[0]?.text as string | undefined) ?? '';
  const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);

  const out: CaptionResult[] = [];
  for (let i = 0; i < batch.length; i++) {
    const raw = lines[i] ?? '';
    if (!raw || /^no construction activity visible/i.test(raw)) continue;
    const clean = clipWords(stripPii(raw), MAX_CAPTION_WORDS);
    if (clean.length === 0) continue;
    out.push({ id: batch[i].id, caption: clean });
  }
  return out;
}

/** Caption an array of photos with at-most-3 retries on transient errors.
 *  Best-effort: returns whatever subset succeeded. The caller treats
 *  missing captions as "photo without observation," not as an error. */
export async function captionPhotos(
  photos: ReadonlyArray<PhotoToCaption>,
  apiKey: string,
  options?: { signal?: AbortSignal },
): Promise<{ captions: ReadonlyArray<CaptionResult>; partial: boolean; errors: string[] }> {
  if (photos.length === 0 || !apiKey) {
    return { captions: [], partial: false, errors: [] };
  }

  const errors: string[] = [];
  const all: CaptionResult[] = [];

  for (let i = 0; i < photos.length; i += BATCH_SIZE) {
    const batch = photos.slice(i, i + BATCH_SIZE);
    let attempt = 0;
    let lastErr: Error | null = null;
    while (attempt < 3) {
      try {
        const out = await callOnce(apiKey, batch, options?.signal);
        all.push(...out);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err as Error;
        attempt += 1;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }
    if (lastErr) errors.push(`batch ${i}-${i + batch.length}: ${lastErr.message}`);
  }

  return { captions: all, partial: errors.length > 0, errors };
}
