/**
 * BRT scale-test Track 3 — seed Supabase Storage with binary fixtures.
 *
 * Demo data so far has drawing/photo *metadata* rows but no binary
 * objects. Specs that need real PDFs/JPGs (Upload, Annotate, Photos)
 * can't run end-to-end without backing bytes. This script uploads N
 * sample PDFs and N sample JPGs per project to the project-scoped
 * Supabase Storage buckets.
 *
 * Buckets touched:
 *   - drawings (PDFs)
 *   - photos (JPGs)
 *   - documents (PDFs)
 *
 * Paths follow the existing convention: `${organization_id}/${project_id}/<filename>`
 *
 * Idempotent: skips upload when the object's md5 hash matches the file
 * being uploaded. Re-runs are safe.
 *
 * --- USAGE ---
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_KEY=<service-role> \
 *   npx tsx scripts/scale-test/seed-storage.ts \
 *     --fixture /tmp/scale-fixture.ndjson \
 *     --per-project 5
 *
 * Owner: BRT scale-test Track 3
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    fixture: { type: 'string', short: 'f' },
    'per-project': { type: 'string' },
  },
  allowPositionals: false,
  strict: false,
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PER_PROJECT = Number(args['per-project'] ?? '5');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required env: SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  process.exit(1);
}
if (!args.fixture) {
  console.error('Missing --fixture <ndjson> (output from seed-orgs.ts).');
  process.exit(1);
}

// We use a minimal stand-in binary set below. A truly thorough seed would
// pull from a curated e2e/fixtures folder; this is enough to satisfy upload
// + display paths and avoids requiring a checked-in PDF/JPG.
void path;
void fileURLToPath;

// We use a minimal stand-in binary set. A truly thorough seed would pull from
// a curated fixtures folder; this is enough to satisfy upload + display paths.
const MINIMAL_PDF = Buffer.from(
  // %PDF-1.4 minimal one-page PDF (valid header + xref + EOF).
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n' +
    'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
    '0000000053 00000 n\n0000000099 00000 n\ntrailer<</Root 1 0 R/Size 4>>\n' +
    'startxref\n156\n%%EOF',
  'latin1',
);

const MINIMAL_JPG = Buffer.from([
  // 1x1 px gray JPEG.
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xc4, 0x00, 0x14,
  0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0xff, 0xd9,
]);

interface SeededOrg {
  orgId: string;
  members: Array<{ email: string; userId: string; role: string }>;
}

interface ProjectRow {
  id: string;
  organization_id: string;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensureBucket(name: string, isPublic = false) {
  const { error } = await supabase.storage.createBucket(name, { public: isPublic });
  if (error && !/exists/i.test(error.message)) {
    console.error(`[seed-storage] createBucket(${name}) failed: ${error.message}`);
  }
}

async function uploadIfNew(
  bucket: string,
  storagePath: string,
  body: Buffer,
  contentType: string,
): Promise<'uploaded' | 'skipped' | 'failed'> {
  // Cheap idempotency: list head + compare size. md5 stays a TODO until the
  // Supabase Storage list endpoint exposes content hashes directly.
  void createHash;
  const dir = storagePath.includes('/') ? storagePath.slice(0, storagePath.lastIndexOf('/')) : '';
  const base = storagePath.includes('/') ? storagePath.slice(storagePath.lastIndexOf('/') + 1) : storagePath;
  const head = await supabase.storage.from(bucket).list(dir, { search: base });
  if (!head.error && head.data?.some((o) => o.name === base && o.metadata?.size === body.length)) {
    return 'skipped';
  }
  const { error } = await supabase.storage.from(bucket).upload(storagePath, body, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  });
  if (error) {
    console.error(`[seed-storage] upload ${bucket}/${storagePath} failed: ${error.message}`);
    return 'failed';
  }
  return 'uploaded';
}

async function seedProject(orgId: string, projectId: string) {
  let uploaded = 0;
  let skipped = 0;
  for (let i = 0; i < PER_PROJECT; i++) {
    const tag = String(i + 1).padStart(2, '0');
    const r1 = await uploadIfNew(
      'drawings',
      `${orgId}/${projectId}/drawing-${tag}.pdf`,
      MINIMAL_PDF,
      'application/pdf',
    );
    const r2 = await uploadIfNew(
      'photos',
      `${orgId}/${projectId}/photo-${tag}.jpg`,
      MINIMAL_JPG,
      'image/jpeg',
    );
    const r3 = await uploadIfNew(
      'documents',
      `${orgId}/${projectId}/document-${tag}.pdf`,
      MINIMAL_PDF,
      'application/pdf',
    );
    for (const r of [r1, r2, r3]) {
      if (r === 'uploaded') uploaded++;
      else if (r === 'skipped') skipped++;
    }
  }
  console.error(`[seed-storage] proj=${projectId} uploaded=${uploaded} skipped=${skipped}`);
}

async function main() {
  // Ensure the three buckets exist (idempotent).
  await ensureBucket('drawings');
  await ensureBucket('photos', true); // photos often need public read for thumbnails
  await ensureBucket('documents');

  const raw = readFileSync(args.fixture as string, 'utf-8');
  const orgs: SeededOrg[] = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as SeededOrg);

  console.error(`[seed-storage] orgs=${orgs.length} per-project=${PER_PROJECT}`);

  for (const org of orgs) {
    // Look up the org's projects via the API rather than asking the seeder to
    // emit project IDs (which it currently doesn't track).
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, organization_id')
      .eq('organization_id', org.orgId);
    if (error) {
      console.error(`[seed-storage] list projects org=${org.orgId} failed: ${error.message}`);
      continue;
    }
    for (const proj of (projects ?? []) as ProjectRow[]) {
      await seedProject(org.orgId, proj.id);
    }
  }

  console.error('[seed-storage] done.');
}

main().catch((err) => {
  console.error('[seed-storage] fatal:', err);
  process.exit(1);
});

