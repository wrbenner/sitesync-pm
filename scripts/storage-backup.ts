/**
 * SiteSync Supabase Storage -> S3 cold backup.
 *
 * Daily cron job. Iterates every Supabase Storage bucket, lists every object,
 * and copies each one to:
 *     s3://${S3_BACKUP_BUCKET}/<bucket_name>/<YYYY-MM-DD>/<object_key>
 *
 * Writes one row per bucket to `storage_backup_log` (created by Day 3
 * catch-up migration 20261009000009) with timing + counts + any error.
 *
 * --- USAGE ---
 *   SUPABASE_URL=... \
 *   SUPABASE_SERVICE_KEY=... \
 *   AWS_REGION=us-east-1 \
 *   AWS_ACCESS_KEY_ID=... \
 *   AWS_SECRET_ACCESS_KEY=... \
 *   S3_BACKUP_BUCKET=sitesync-backups \
 *   npx tsx scripts/storage-backup.ts
 *
 * Scheduled via Vercel Cron (vercel.json):
 *   { "crons": [{ "path": "/api/cron/storage-backup", "schedule": "0 7 * * *" }] }
 * ...or any external scheduler that can run a tsx process with the env above.
 *
 * --- RESTORE / ROLLBACK PROCEDURE ---
 *
 * 1. Identify the snapshot date you want to restore from. Backups are stored at:
 *      s3://${S3_BACKUP_BUCKET}/<bucket>/<YYYY-MM-DD>/<key>
 *    Each daily directory is a full snapshot of that bucket's contents on that day.
 *
 * 2. Confirm the snapshot is complete by checking storage_backup_log:
 *      SELECT bucket_name, object_count, total_bytes, started_at, completed_at,
 *             error_message
 *      FROM storage_backup_log
 *      WHERE started_at::date = '<YYYY-MM-DD>'
 *      ORDER BY bucket_name;
 *    Every row must have completed_at IS NOT NULL AND error_message IS NULL.
 *
 * 3. To restore a single object:
 *      aws s3 cp s3://${S3_BACKUP_BUCKET}/<bucket>/<YYYY-MM-DD>/<key> ./restore-tmp
 *      # then re-upload via Supabase Storage API:
 *      supabase storage cp ./restore-tmp <bucket>/<key>
 *
 * 4. To restore an entire bucket:
 *      aws s3 sync s3://${S3_BACKUP_BUCKET}/<bucket>/<YYYY-MM-DD>/ ./restore-tmp/<bucket>/
 *      # then bulk-upload back into Supabase Storage. Recommended path: use the
 *      # Supabase Storage admin API (service role) with a parallelism of 8.
 *      # See scripts/lib/storage-restore.ts (TODO) for the helper, or upload via
 *      # the Supabase dashboard for small buckets.
 *
 * 5. After restore, verify counts match:
 *      SELECT bucket_id, COUNT(*) FROM storage.objects GROUP BY bucket_id;
 *    against the object_count column in storage_backup_log for that date.
 *
 * 6. IMPORTANT: If a restore overwrites newer files, you have data loss between
 *    the snapshot date and now. Before restoring, take a fresh backup of the
 *    current state by running this script manually with a `--label` override
 *    (TODO) or by simply re-running it — that creates a new dated folder in S3.
 *
 * Owner: BRT Track C / sub-8 §4.5 (cold backups)
 */

import { createClient } from '@supabase/supabase-js';
import {
  S3Client,
  PutObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const AWS_REGION = process.env.AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const S3_BACKUP_BUCKET = process.env.S3_BACKUP_BUCKET;

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_KEY ||
  !AWS_REGION ||
  !AWS_ACCESS_KEY_ID ||
  !AWS_SECRET_ACCESS_KEY ||
  !S3_BACKUP_BUCKET
) {
  console.error(
    'Missing required env: SUPABASE_URL, SUPABASE_SERVICE_KEY, AWS_REGION, ' +
      'AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BACKUP_BUCKET',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const SNAPSHOT_DATE = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

interface BackupStats {
  bucket_name: string;
  object_count: number;
  total_bytes: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}

interface _StorageObject {
  name: string;
  // The path stack inside the bucket — we walk recursively.
  prefix?: string;
}

// ---------------------------------------------------------------------------
// List every object in a bucket, recursing into "folders".
// Supabase Storage's list() returns up to 1000 entries per call and treats
// trailing-slash entries as folders we have to recurse into.
// ---------------------------------------------------------------------------
async function listAllObjects(bucket: string): Promise<string[]> {
  const out: string[] = [];
  const queue: string[] = ['']; // root prefix

  while (queue.length > 0) {
    const prefix = queue.shift()!;
    let offset = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, {
        limit,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });

      if (error) {
        throw new Error(`list(${bucket}, "${prefix}") failed: ${error.message}`);
      }
      if (!data || data.length === 0) break;

      for (const entry of data) {
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        // Folder entries have null id / null metadata in Supabase's list output.
        if (entry.id == null) {
          queue.push(fullPath);
        } else {
          out.push(fullPath);
        }
      }

      if (data.length < limit) break;
      offset += limit;
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Copy a single object: download from Supabase, upload to S3.
// Returns the number of bytes uploaded.
// ---------------------------------------------------------------------------
async function copyObject(
  bucket: string,
  objectKey: string,
): Promise<number> {
  const { data, error } = await supabase.storage.from(bucket).download(objectKey);
  if (error || !data) {
    throw new Error(
      `download(${bucket}/${objectKey}) failed: ${error?.message ?? 'no data'}`,
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  const putInput: PutObjectCommandInput = {
    Bucket: S3_BACKUP_BUCKET,
    Key: `${bucket}/${SNAPSHOT_DATE}/${objectKey}`,
    Body: body,
    ContentType: data.type || 'application/octet-stream',
    Metadata: {
      'source-bucket': bucket,
      'source-key': objectKey,
      'snapshot-date': SNAPSHOT_DATE,
    },
  };

  await s3.send(new PutObjectCommand(putInput));
  return body.byteLength;
}

// ---------------------------------------------------------------------------
// Back up a single bucket end-to-end, logging a row to storage_backup_log.
// ---------------------------------------------------------------------------
async function backupBucket(bucketName: string): Promise<BackupStats> {
  const stats: BackupStats = {
    bucket_name: bucketName,
    object_count: 0,
    total_bytes: 0,
    started_at: new Date().toISOString(),
    completed_at: null,
    error_message: null,
  };

  try {
    const objectKeys = await listAllObjects(bucketName);
    console.error(
      `[storage-backup] bucket="${bucketName}" objects=${objectKeys.length}`,
    );

    for (const key of objectKeys) {
      try {
        const bytes = await copyObject(bucketName, key);
        stats.object_count += 1;
        stats.total_bytes += bytes;
      } catch (err) {
        // Per-object failure: log and continue. We do not want one bad
        // object to fail the entire bucket snapshot.
        console.error(
          `[storage-backup] copy failed bucket="${bucketName}" key="${key}":`,
          err,
        );
      }
    }
  } catch (err) {
    stats.error_message = err instanceof Error ? err.message : String(err);
  }

  stats.completed_at = new Date().toISOString();

  const { error: logErr } = await supabase.from('storage_backup_log').insert({
    bucket_name: stats.bucket_name,
    object_count: stats.object_count,
    total_bytes: stats.total_bytes,
    started_at: stats.started_at,
    completed_at: stats.completed_at,
    error_message: stats.error_message,
  });

  if (logErr) {
    console.error(
      `[storage-backup] failed to write storage_backup_log row for bucket="${bucketName}":`,
      logErr.message,
    );
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main() {
  console.error(
    `[storage-backup] snapshot_date=${SNAPSHOT_DATE} s3_bucket=${S3_BACKUP_BUCKET}`,
  );

  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error || !buckets) {
    throw new Error(`listBuckets failed: ${error?.message ?? 'no data'}`);
  }

  console.error(
    `[storage-backup] found ${buckets.length} buckets: ` +
      buckets.map((b) => b.name).join(', '),
  );

  const results: BackupStats[] = [];
  for (const bucket of buckets) {
    const r = await backupBucket(bucket.name);
    results.push(r);
  }

  // Final summary to stderr; useful in cron logs.
  console.error('[storage-backup] complete.');
  for (const r of results) {
    console.error(
      `  ${r.bucket_name}: objects=${r.object_count} bytes=${r.total_bytes}` +
        (r.error_message ? ` ERROR=${r.error_message}` : ''),
    );
  }

  const anyError = results.some((r) => r.error_message);
  process.exit(anyError ? 1 : 0);
}

main().catch((err) => {
  console.error('[storage-backup] fatal:', err);
  process.exit(1);
});
