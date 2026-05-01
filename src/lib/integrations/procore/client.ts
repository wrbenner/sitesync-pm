/**
 * ProcoreClient — paginated, throttled HTTP client for Procore API.
 *
 * Procore caps requests at 10 req/sec per token; we run at 9 to leave
 * headroom. 429 responses are honored via Retry-After and re-tried with
 * exponential backoff up to {maxRetries} times.
 *
 * The constructor accepts an optional `fetch` impl so tests can stub
 * the network entirely. No real HTTP calls are made unless the caller
 * wires the global fetch.
 *
 * All methods return `Result<T>` so the caller handles errors via the
 * standard SiteSync service-layer pattern.
 */

import type {
  ProcoreClientOptions,
  ProcoreProject,
  ProcoreRfi,
  ProcoreSubmittal,
  ProcoreChangeOrder,
  ProcoreDailyLog,
  ProcoreDrawing,
  ProcorePhoto,
  ProcoreContact,
  ProcoreSchedule,
  ProcoreBudget,
} from '../../../types/integrations';
import {
  ok,
  fail,
  dbError,
  permissionError,
  type Result,
  type ServiceError,
} from '../../../services/errors';

const DEFAULT_BASE: Record<string, string> = {
  us: 'https://api.procore.com',
  eu: 'https://api.procore-eu.com',
  au: 'https://api.procore-au.com',
};

/**
 * Token-bucket throttle. Each acquire() blocks until a token is
 * available. Tokens replenish at `rate` per second. We use this
 * rather than a strict 1/N-sec sleep so bursts of <N requests land
 * immediately, matching Procore's actual rate-limit behaviour.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;
  constructor(
    public readonly rate: number,
    public readonly capacity: number = rate,
    private readonly nowFn: () => number = Date.now,
    private readonly sleepFn: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {
    this.tokens = capacity;
    this.last = nowFn();
  }
  async acquire(): Promise<void> {
    const refill = () => {
      const now = this.nowFn();
      const elapsed = (now - this.last) / 1000;
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.rate);
      this.last = now;
    };
    refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const needed = 1 - this.tokens;
    const waitMs = Math.ceil((needed / this.rate) * 1000);
    await this.sleepFn(waitMs);
    refill();
    this.tokens = Math.max(0, this.tokens - 1);
  }
}

export interface FetchLike {
  (url: string, init?: RequestInit): Promise<Response>;
}

export class ProcoreClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly bucket: TokenBucket;
  private readonly fetchImpl: FetchLike;
  private readonly maxRetries: number;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(opts: ProcoreClientOptions) {
    this.token = opts.accessToken;
    this.baseUrl =
      opts.baseUrl ?? DEFAULT_BASE[opts.region ?? 'us'] ?? DEFAULT_BASE.us;
    const rate = opts.requestsPerSecond ?? 9;
    this.maxRetries = opts.maxRetries ?? 5;
    this.fetchImpl =
      (opts.fetch as FetchLike | undefined) ??
      (typeof fetch !== 'undefined' ? (fetch as FetchLike) : undefinedFetch);
    this.sleepFn = (ms) => new Promise((r) => setTimeout(r, ms));
    this.bucket = new TokenBucket(rate);
  }

  // ── Public API ────────────────────────────────────────

  async listProjects(): Promise<Result<ProcoreProject[]>> {
    return this.collectAll<ProcoreProject>('/rest/v1.0/projects');
  }

  async listRfis(projectId: number | string): Promise<Result<ProcoreRfi[]>> {
    return this.collectAll<ProcoreRfi>('/rest/v1.0/projects/' + projectId + '/rfis');
  }

  async listSubmittals(
    projectId: number | string,
  ): Promise<Result<ProcoreSubmittal[]>> {
    return this.collectAll<ProcoreSubmittal>(
      '/rest/v1.0/projects/' + projectId + '/submittals',
    );
  }

  async listChangeOrders(
    projectId: number | string,
  ): Promise<Result<ProcoreChangeOrder[]>> {
    return this.collectAll<ProcoreChangeOrder>(
      '/rest/v1.0/projects/' + projectId + '/change_orders',
    );
  }

  async listDailyLogs(
    projectId: number | string,
  ): Promise<Result<ProcoreDailyLog[]>> {
    return this.collectAll<ProcoreDailyLog>(
      '/rest/v1.0/projects/' + projectId + '/daily_logs',
    );
  }

  async listDrawings(
    projectId: number | string,
  ): Promise<Result<ProcoreDrawing[]>> {
    return this.collectAll<ProcoreDrawing>(
      '/rest/v1.0/projects/' + projectId + '/drawings',
    );
  }

  async listPhotos(projectId: number | string): Promise<Result<ProcorePhoto[]>> {
    return this.collectAll<ProcorePhoto>(
      '/rest/v1.0/projects/' + projectId + '/photos',
    );
  }

  async listContacts(
    projectId: number | string,
  ): Promise<Result<ProcoreContact[]>> {
    return this.collectAll<ProcoreContact>(
      '/rest/v1.0/projects/' + projectId + '/contacts',
    );
  }

  async getSchedule(
    projectId: number | string,
  ): Promise<Result<ProcoreSchedule>> {
    return this.fetchOne<ProcoreSchedule>(
      '/rest/v1.0/projects/' + projectId + '/schedule',
    );
  }

  async getBudget(projectId: number | string): Promise<Result<ProcoreBudget>> {
    return this.fetchOne<ProcoreBudget>(
      '/rest/v1.0/projects/' + projectId + '/budget',
    );
  }

  // ── Internals ────────────────────────────────────────

  /** Paginated collector. Accumulates pages until empty/short page. */
  private async collectAll<T>(path: string): Promise<Result<T[]>> {
    const out: T[] = [];
    const perPage = 100;
    let page = 1;
    while (true) {
      const result = await this.fetchPage<T>(path, page, perPage);
      if (result.error) return fail(result.error);
      const arr = result.data ?? [];
      out.push(...arr);
      if (arr.length < perPage) break;
      page += 1;
      if (page > 10000) break; // safety
    }
    return ok(out);
  }

  private async fetchPage<T>(
    path: string,
    page: number,
    perPage: number,
  ): Promise<Result<T[]>> {
    const url = this.buildUrl(path, { page, per_page: perPage });
    const response = await this.requestWithRetry(url);
    if (response.error) return fail(response.error);
    const body = response.data!;
    if (!Array.isArray(body)) {
      return fail(dbError('Procore API returned non-array page', { path, page }));
    }
    return ok(body as T[]);
  }

  private async fetchOne<T>(path: string): Promise<Result<T>> {
    const url = this.buildUrl(path, {});
    const response = await this.requestWithRetry(url);
    if (response.error) return fail(response.error);
    return ok(response.data as T);
  }

  private buildUrl(path: string, query: Record<string, string | number>): string {
    const parts = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
    const sep = parts.length ? '?' + parts.join('&') : '';
    return this.baseUrl + path + sep;
  }

  /**
   * Internal: rate-limited fetch with retry/backoff.
   * Exposed via private name so tests can spy via prototype if needed,
   * but consumers call the high-level methods.
   */
  async requestWithRetry(url: string): Promise<Result<unknown>> {
    let attempt = 0;
    let backoffMs = 250;
    while (true) {
      await this.bucket.acquire();
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          headers: {
            Authorization: 'Bearer ' + this.token,
            Accept: 'application/json',
          },
        });
      } catch (e) {
        if (attempt >= this.maxRetries) {
          return fail(dbError('Procore network error: ' + (e as Error).message));
        }
        await this.sleepFn(backoffMs);
        backoffMs *= 2;
        attempt++;
        continue;
      }
      if (res.status === 429) {
        if (attempt >= this.maxRetries) {
          return fail(dbError('Procore rate limit exceeded after retries'));
        }
        const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
        await this.sleepFn(retryAfter ?? backoffMs);
        backoffMs *= 2;
        attempt++;
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        return fail(permissionError('Procore unauthorized (status ' + res.status + ')'));
      }
      if (res.status >= 500) {
        if (attempt >= this.maxRetries) {
          return fail(dbError('Procore server error ' + res.status));
        }
        await this.sleepFn(backoffMs);
        backoffMs *= 2;
        attempt++;
        continue;
      }
      if (!res.ok) {
        const text = await safeText(res);
        const err: ServiceError = dbError('Procore HTTP ' + res.status + ': ' + text, {
          url,
          status: res.status,
        });
        return fail(err);
      }
      try {
        const json = await res.json();
        return ok(json);
      } catch {
        return fail(dbError('Procore response was not JSON', { url }));
      }
    }
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const asInt = parseInt(value, 10);
  if (!Number.isNaN(asInt) && asInt >= 0) return asInt * 1000;
  const dt = Date.parse(value);
  if (!Number.isNaN(dt)) return Math.max(0, dt - Date.now());
  return null;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<unreadable>';
  }
}

const undefinedFetch: FetchLike = () => {
  throw new Error('No fetch implementation available — pass opts.fetch');
};
