import { describe, it, expect, vi } from 'vitest';
import { ProcoreClient, TokenBucket } from '../client';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers as object) },
  });
}

describe('TokenBucket', () => {
  it('refills at the configured rate', async () => {
    let now = 0;
    const sleeps: number[] = [];
    const bucket = new TokenBucket(
      9,
      9,
      () => now,
      async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    );
    for (let i = 0; i < 9; i++) await bucket.acquire();
    // 10th acquire should sleep ~111ms (1/9 sec).
    await bucket.acquire();
    expect(sleeps.length).toBe(1);
    expect(sleeps[0]).toBeGreaterThanOrEqual(110);
    expect(sleeps[0]).toBeLessThanOrEqual(120);
  });
});

describe('ProcoreClient', () => {
  it('handles a 200 list response', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([{ id: 1, name: 'P1' }]));
    const client = new ProcoreClient({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof fetch,
    });
    const result = await client.listProjects();
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: 1, name: 'P1' }]);
  });

  it('retries on 429 with Retry-After', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return new Response('rate limited', {
          status: 429,
          headers: { 'Retry-After': '0' },
        });
      }
      return jsonResponse([]);
    });
    const client = new ProcoreClient({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 3,
    });
    const result = await client.listRfis(1);
    expect(result.error).toBeNull();
    expect(calls).toBe(2);
  });

  it('returns permission error on 401', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 401 }));
    const client = new ProcoreClient({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof fetch,
    });
    const result = await client.listProjects();
    expect(result.error).not.toBeNull();
    expect(result.error?.category).toBe('PermissionError');
  });

  it('paginates until short page', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        return jsonResponse(new Array(100).fill(null).map((_, i) => ({ id: i, number: i, subject: 's', status: 'open', created_at: 'x' })));
      }
      // page=2 returns 5 items (short)
      return jsonResponse(new Array(5).fill(null).map((_, i) => ({ id: 100 + i, number: i, subject: 's', status: 'open', created_at: 'x' })));
    });
    const client = new ProcoreClient({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof fetch,
    });
    const result = await client.listRfis(99);
    expect(result.error).toBeNull();
    expect(result.data?.length).toBe(105);
    expect(calls).toBe(2);
  });

  it('gates requests through the throttle (≥111ms apart at 9/sec)', async () => {
    const stamps: number[] = [];
    const fetchImpl = vi.fn(async () => {
      stamps.push(Date.now());
      return jsonResponse([]);
    });
    const client = new ProcoreClient({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof fetch,
      requestsPerSecond: 9,
    });
    // Burn the bucket: 9 immediate, then next must wait.
    for (let i = 0; i < 9; i++) await client.listProjects();
    const t0 = Date.now();
    await client.listProjects();
    const t1 = Date.now();
    expect(t1 - t0).toBeGreaterThanOrEqual(100); // tolerate timer jitter
  });

  it('5xx triggers retry then succeeds', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls < 2) return new Response('boom', { status: 503 });
      return jsonResponse([]);
    });
    const client = new ProcoreClient({
      accessToken: 't',
      fetch: fetchImpl as unknown as typeof fetch,
    });
    const result = await client.listProjects();
    expect(result.error).toBeNull();
    expect(calls).toBe(2);
  });
});
