/**
 * =============================================================================
 * Layer 2 Test: Input Validation
 * =============================================================================
 * Validates that the API rejects malformed request bodies with 400-level errors.
 *
 * DOMAIN_KERNEL_SPEC.md §2.4: IDs are uuid, required fields enforced.
 * DOMAIN_KERNEL_SPEC.md §5: Status values must be valid enum members.
 * =============================================================================
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
interface EvalConfig {
  supabase: {
    url: string;
    anon_key: string;
    service_role_key: string;
  };
}

function loadConfig(): EvalConfig {
  const configPath = resolve(__dirname, "..", "config.json");
  const raw = readFileSync(configPath, "utf-8");
  const config = JSON.parse(raw) as EvalConfig;

  const resolveEnv = (val: string): string => {
    if (val.startsWith("$")) {
      const envVal = process.env[val.slice(1)];
      if (!envVal) return "";
      return envVal;
    }
    return val;
  };

  return {
    supabase: {
      url: resolveEnv(config.supabase.url),
      anon_key: resolveEnv(config.supabase.anon_key),
      service_role_key: resolveEnv(config.supabase.service_role_key),
    },
  };
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testId: string, message: string) {
  if (condition) {
    console.log(`PASS [${testId}] ${message}`);
    passed++;
  } else {
    console.error(`FAIL [${testId}] ${message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
async function runTests() {
  const config = loadConfig();
  const baseUrl = config.supabase.url;
  const serviceKey = config.supabase.service_role_key;

  if (!baseUrl || !serviceKey) {
    console.log("SKIP [V.1] Supabase URL or service_role_key not configured");
    console.log("SKIP [V.2] Supabase URL or service_role_key not configured");
    console.log("SKIP [V.3] Supabase URL or service_role_key not configured");
    console.log("SKIP [V.4] Supabase URL or service_role_key not configured");
    console.log("SKIP [V.5] Supabase URL or service_role_key not configured");
    console.log("\n--- Input Validation: 0 passed, 0 failed (all skipped) ---");
    process.exit(0);
  }

  // Connectivity check
  try {
    await fetch(`${baseUrl}/rest/v1/`, { method: "HEAD", signal: AbortSignal.timeout(10000) });
  } catch {
    console.log("SKIP [V.1] Supabase unreachable");
    console.log("SKIP [V.2] Supabase unreachable");
    console.log("SKIP [V.3] Supabase unreachable");
    console.log("SKIP [V.4] Supabase unreachable");
    console.log("SKIP [V.5] Supabase unreachable");
    console.log("\n--- Input Validation: 0 passed, 0 failed (all skipped — host unreachable) ---");
    process.exit(0);
  }

  // Use service_role key for these tests to bypass RLS and isolate input
  // validation from permission checks.
  const headers = {
    "Content-Type": "application/json",
    apikey: config.supabase.anon_key,
    Authorization: `Bearer ${serviceKey}`,
    Prefer: "return=minimal",
  };

  // -------------------------------------------------------------------------
  // Test V.1: POST /rfis with invalid UUID for project_id → 400 or 422
  // -------------------------------------------------------------------------
  {
    const res = await fetch(`${baseUrl}/rest/v1/rfis`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "not-a-valid-uuid",
        title: "Invalid UUID test",
        status: "draft",
      }),
    });

    // Supabase/PostgREST returns 400 for type mismatches
    const isRejected = res.status >= 400 && res.status < 500;
    assert(
      isRejected,
      "V.1",
      `POST /rfis with invalid UUID → ${res.status} (expected 4xx)`
    );
  }

  // -------------------------------------------------------------------------
  // Test V.2: POST /rfis with empty body → 400
  // -------------------------------------------------------------------------
  {
    const res = await fetch(`${baseUrl}/rest/v1/rfis`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });

    // Missing required fields (project_id at minimum) should fail
    const isRejected = res.status >= 400 && res.status < 500;
    assert(
      isRejected,
      "V.2",
      `POST /rfis with empty body → ${res.status} (expected 4xx)`
    );
  }

  // -------------------------------------------------------------------------
  // Test V.3: POST /rfis with invalid status value → 400 or 422
  // -------------------------------------------------------------------------
  {
    const res = await fetch(`${baseUrl}/rest/v1/rfis`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "a1000000-0000-0000-0000-000000000001",
        title: "Invalid status test",
        status: "banana", // Not a valid RFI status
      }),
    });

    // If status is enum-constrained, this should fail
    const isRejected = res.status >= 400 && res.status < 500;
    assert(
      isRejected,
      "V.3",
      `POST /rfis with invalid status 'banana' → ${res.status} (expected 4xx)`
    );
  }

  // -------------------------------------------------------------------------
  // Test V.4: PATCH /rfis with malformed JSON → 400
  // -------------------------------------------------------------------------
  {
    const res = await fetch(
      `${baseUrl}/rest/v1/rfis?id=eq.aaa00000-0000-0000-0000-000000000001`,
      {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: "{ this is not valid json }",
      }
    );

    assert(
      res.status === 400,
      "V.4",
      `PATCH /rfis with malformed JSON → ${res.status} (expected 400)`
    );
  }

  // -------------------------------------------------------------------------
  // Test V.5: POST with SQL injection attempt in field → no server error
  // -------------------------------------------------------------------------
  {
    const res = await fetch(`${baseUrl}/rest/v1/rfis`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        project_id: "a1000000-0000-0000-0000-000000000001",
        title: "'; DROP TABLE rfis; --",
        status: "draft",
      }),
    });

    // Should either succeed (the string is just a string) or fail with a
    // constraint error — but never a 500 indicating SQL injection worked
    assert(
      res.status !== 500,
      "V.5",
      `POST with SQL injection string → ${res.status} (must not be 500)`
    );

    // If it was created, clean it up
    if (res.status === 201 || res.status === 200) {
      // Attempt cleanup
      await fetch(
        `${baseUrl}/rest/v1/rfis?title=eq.'; DROP TABLE rfis; --'`,
        { method: "DELETE", headers }
      );
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n--- Input Validation: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Input validation tests crashed:", err);
  process.exit(1);
});
