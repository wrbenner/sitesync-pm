/**
 * check-doc-links.ts
 *
 * Walks docs/**\/*.md, parses every markdown link, and validates that:
 *   - relative-path links resolve on disk
 *   - source citations of the form `path/to/file.ext` (in inline code, link
 *     targets, or the form `path/to/file.ext:LINE`) point to real files
 *
 * Exits non-zero on any broken link.
 *
 * Run: npx tsx scripts/check-doc-links.ts [docsDir]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "..");
const DOCS_DIR = path.resolve(REPO_ROOT, process.argv[2] ?? "docs");

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
// Inline-code citations: `src/lib/foo.ts` or `src/lib/foo.ts:42`
const CITE_RE = /`((?:src|supabase|scripts|docs|public|e2e)\/[A-Za-z0-9_./@-]+\.[A-Za-z0-9]+)(?::\d+(?:-\d+)?)?`/g;

interface Issue {
  file: string;
  raw: string;
  resolved: string;
}

function listMarkdownFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}

function isExternal(href: string): boolean {
  return /^(https?:|mailto:|tel:|#)/i.test(href);
}

function stripFragment(href: string): string {
  const hashAt = href.indexOf("#");
  if (hashAt >= 0) return href.slice(0, hashAt);
  return href;
}

function stripLineRef(href: string): string {
  // Strip a trailing ":NN" or ":NN-MM" line reference if it's the last segment
  const m = href.match(/^(.*?):\d+(?:-\d+)?$/);
  if (m) return m[1];
  return href;
}

function checkLink(docFile: string, href: string): { ok: boolean; resolved: string } {
  let target = stripFragment(href.trim());
  target = stripLineRef(target);
  if (!target) {
    return { ok: true, resolved: target };
  }
  const docDir = path.dirname(docFile);
  const resolved = path.isAbsolute(target)
    ? target
    : path.resolve(docDir, target);
  return { ok: fs.existsSync(resolved), resolved };
}

function checkCite(citePath: string): { ok: boolean; resolved: string } {
  const stripped = stripLineRef(citePath);
  const resolved = path.resolve(REPO_ROOT, stripped);
  return { ok: fs.existsSync(resolved), resolved };
}

function main() {
  const files = listMarkdownFiles(DOCS_DIR);
  const broken: Issue[] = [];
  let totalLinks = 0;
  let totalCites = 0;

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");

    // Markdown links
    for (const match of text.matchAll(LINK_RE)) {
      const href = match[2];
      if (isExternal(href)) continue;
      totalLinks++;
      const { ok, resolved } = checkLink(file, href);
      if (!ok) {
        broken.push({ file, raw: href, resolved });
      }
    }

    // Inline-code citations into the repo
    for (const match of text.matchAll(CITE_RE)) {
      const citePath = match[1];
      totalCites++;
      const { ok, resolved } = checkCite(citePath);
      if (!ok) {
        broken.push({ file, raw: match[0], resolved });
      }
    }
  }

  // Summary
  console.log(`Total files: ${files.length}. Total links: ${totalLinks + totalCites}. Broken: ${broken.length}.`);
  if (broken.length > 0) {
    console.error("\nBroken references:");
    for (const issue of broken) {
      const rel = path.relative(REPO_ROOT, issue.file);
      console.error(`  ${rel}: ${issue.raw}`);
      console.error(`    -> ${issue.resolved} (not found)`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main();
