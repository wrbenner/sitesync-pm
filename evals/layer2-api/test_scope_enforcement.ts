/**
 * =============================================================================
 * Layer 2 Test: Scope Enforcement (SCAFFOLD)
 * =============================================================================
 * Validates that authenticated users can only access data within their
 * authorized scope (project membership).
 *
 * STATUS: All tests will SKIP until a reliable test-user auth path exists.
 * The current setup.sql creates auth.users rows without password hashes,
 * so getTestUserToken() cannot sign in. These tests become active after:
 *   1. project_members.role migration (Step 4 Phase 1)
 *   2. Test user auth setup (either password hashes in setup.sql or
 *      service-role token impersonation)
 *
 * Gold-Standard Fixtures:
 *   #1  — Tenant isolation via API
 *   #12 — Subcontractor cannot see financial data via API
 *   #19 — Portal user limited access
 *
 * DOMAIN_KERNEL_SPEC.md §2.1: "Every entity belongs to exactly one scope type."
 * DOMAIN_KERNEL_SPEC.md §7: "Permission Matrix"
 * =============================================================================
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Config & helpers
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
// JWT helpers — create test user tokens via Supabase Auth Admin API
// ---------------------------------------------------------------------------
// In a real Supabase test environment, you'd sign in test users to get JWTs.
// For eval scaffolding, we use the service role to call the admin endpoint.

async function getTestUserToken(
  config: EvalConfig,
  email: string,
  password: string = "test-password-12345"
): Promise<string | null> {
  // Attempt to sign in via Supabase Auth REST API
  const res = await fetch(`${config.supabase.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.supabase.anon_key,
    },
    body: JSON.stringify({ email, password }),
  });

  if (res.status !== 200) {
    console.warn(`Could not get token for ${email}: HTTP ${res.status}`);
    return null;
  }

  const body = await res.json();
  return body.access_token ?? null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
async function runTests() {
  const config = loadConfig();
  const baseUrl = config.supabase.url;

  if (!baseUrl) {
    console.log("SKIP [S.1] Supabase URL not configured");
    console.log("SKIP [S.2] Supabase URL not configured");
    console.log("SKIP [S.3] Supabase URL not configured");
    console.log("\n--- Scope Enforcement: 0 passed, 0 failed (all skipped) ---");
    process.exit(0);
  }

  // -------------------------------------------------------------------------
  // Test S.1: Authenticated user fetching another org's project → 0 rows or 403
  // Fixture #1 via API
  // -------------------------------------------------------------------------
  {
    // Try to get a token for Bob (Org B)
    const bobToken = await getTestUserToken(config, "bob@test.sitesync.dev");

    if (!bobToken) {
      console.log(
        "SKIP [S.1] Cannot obtain Bob's JWT — test user auth not configured"
      );
    } else {
      // Bob queries for RFIs in Project Alpha (Org A)
      const projectAlphaId = "a1000000-0000-0000-0000-000000000001";
      const res = await fetch(
        `${baseUrl}/rest/v1/rfis?project_id=eq.${projectAlphaId}&select=id,title`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            apikey: config.supabase.anon_key,
            Authorization: `Bearer ${bobToken}`,
          },
        }
      );

      if (res.status === 403) {
        assert(true, "S.1", `Bob fetching Org A RFIs → 403 Forbidden`);
      } else if (res.status === 200) {
        const body = await res.json();
        assert(
          Array.isArray(body) && body.length === 0,
          "S.1",
          `Bob fetching Org A RFIs → 200 with ${
            Array.isArray(body) ? body.length : "?"
          } rows (expected 0)`
        );
      } else {
        assert(false, "S.1", `Unexpected status: ${res.status}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Test S.2: Subcontractor fetching budget_items → 0 rows or 403
  // Fixture #12 via API
  // -------------------------------------------------------------------------
  {
    const charlieToken = await getTestUserToken(
      config,
      "charlie@test.sitesync.dev"
    );

    if (!charlieToken) {
      console.log(
        "SKIP [S.2] Cannot obtain Charlie's JWT — test user auth not configured"
      );
    } else {
      const projectAlphaId = "a1000000-0000-0000-0000-000000000001";
      const res = await fetch(
        `${baseUrl}/rest/v1/budget_items?project_id=eq.${projectAlphaId}&select=id,cost_code,original_amount`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            apikey: config.supabase.anon_key,
            Authorization: `Bearer ${charlieToken}`,
          },
        }
      );

      if (res.status === 403) {
        assert(true, "S.2", `Charlie (sub) fetching budget_items → 403`);
      } else if (res.status === 200) {
        const body = await res.json();
        assert(
          Array.isArray(body) && body.length === 0,
          "S.2",
          `Charlie (sub) fetching budget_items → ${body.length} rows (expected 0)`
        );
      } else {
        assert(false, "S.2", `Unexpected status: ${res.status}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Test S.3: Subcontractor CAN see RFIs (permitted per §7)
  // Fixture #12 via API — positive case
  // -------------------------------------------------------------------------
  {
    const charlieToken = await getTestUserToken(
      config,
      "charlie@test.sitesync.dev"
    );

    if (!charlieToken) {
      console.log(
        "SKIP [S.3] Cannot obtain Charlie's JWT — test user auth not configured"
      );
    } else {
      const projectAlphaId = "a1000000-0000-0000-0000-000000000001";
      const res = await fetch(
        `${baseUrl}/rest/v1/rfis?project_id=eq.${projectAlphaId}&select=id,title`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            apikey: config.supabase.anon_key,
            Authorization: `Bearer ${charlieToken}`,
          },
        }
      );

      if (res.status === 200) {
        const body = await res.json();
        assert(
          Array.isArray(body) && body.length > 0,
          "S.3",
          `Charlie (sub) fetching RFIs → ${body.length} rows (expected > 0)`
        );
      } else {
        assert(false, "S.3", `Unexpected status: ${res.status} (expected 200)`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n--- Scope Enforcement: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Scope enforcement tests crashed:", err);
  process.exit(1);
});
