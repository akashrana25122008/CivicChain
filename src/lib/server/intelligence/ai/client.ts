/**
 * Minimal, provider-agnostic client for OpenAI-compatible chat-completions
 * endpoints (OpenAI, Azure OpenAI, OpenRouter, Ollama, vLLM, …). Configured
 * exclusively via server env vars; never imported by client bundles.
 *
 * The only timers here are real network timeouts and genuine retry backoffs —
 * nothing waits to "look" like AI processing.
 */

import { getRequestContext } from '../../requestContext';

export interface AiCallInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  timeoutMs?: number;
  maxTokens?: number;
  /** Optional vision context: { mimeType, base64Data } thumbnails. */
  images?: Array<{ mimeType: string; base64: string }>;
}

export class AiServiceError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, opts: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = 'AiServiceError';
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}

function visionParts(images: AiCallInput['images']) {
  if (!images || images.length === 0) return [];
  return images.map((img) => ({
    type: 'image_url',
    image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
  }));
}

async function rawChatCompletion(input: AiCallInput): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 30_000);
  try {
    const res = await fetch(`${input.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: input.system },
          {
            role: 'user',
            content: visionParts(input.images).length
              ? [
                  { type: 'text', text: input.user },
                  ...visionParts(input.images),
                ]
              : input.user,
          },
        ],
        max_tokens: input.maxTokens ?? 512,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const status = res.status;
      const text = await res.text().catch(() => '');
      throw new AiServiceError(
        `AI request failed (${status}): ${text.slice(0, 300)}`,
        { status, retryable: status === 429 || status >= 500 },
      );
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content || !content.trim()) {
      throw new AiServiceError('AI response contained no content.', { retryable: true });
    }
    return content;
  } catch (err) {
    if (err instanceof AiServiceError) throw err;
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new AiServiceError(`AI request failed: ${aborted ? 'timed out' : 'network error'}`, {
      retryable: aborted,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Retries transient failures and malformed output (real backoff, max 1s). */
export async function chatCompletionWithRetry(
  input: AiCallInput,
  maxRetries = 1,
): Promise<string> {
  let lastError: unknown = null;
  const attempts = maxRetries + 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const attemptStart = performance.now();
    try {
      const content = await rawChatCompletion(input);
      const durationMs = Math.round(performance.now() - attemptStart);
      getRequestContext()
        ?.logger?.info({ ai: true, model: input.model, durationMs, attempt: attempt + 1, ok: true }, 'ai call');
      return content;
    } catch (err) {
      const durationMs = Math.round(performance.now() - attemptStart);
      getRequestContext()
        ?.logger?.warn({ ai: true, model: input.model, durationMs, attempt: attempt + 1, ok: false }, 'ai call failed');
      lastError = err;
      const retryable = err instanceof AiServiceError && err.retryable;
      if (!retryable || attempt === attempts - 1) throw err;
      // Genuine backoff before retrying a transient failure.
      await new Promise((resolve) => setTimeout(resolve, 300 + attempt * 300));
    }
  }
  throw lastError;
}