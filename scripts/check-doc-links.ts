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

// A cite/link is exempt from the existence check when its surrounding line
// declares it as planned, new, WIP, deferred, or removed. This lets spec docs
// and receipts reference files that don't exist yet (Lap 3+ work) without
// lying about their status.
//
// Recognized markers (case-insensitive, on the same line as the cite):
//   (planned) | (NEW) | (WIP) | (TODO) | (deferred) | (removed)
//   | NEW [anything] |   (table cell starting with NEW/PLANNED/...)
//   NEW —    | PLANNED:    (status word at start of cell or sentence)
//   — Deferred to ...     (em-dash or colon followed by status word)
//   to be (created|written|added|implemented|built)
//   will be (created|written|added|implemented|shipped|built)
//   coming in (Lap 3|Wave 2|Q3|...)  (explicit deferral phrase)
//
// Word boundaries on every keyword so accidental prose like "a new feature"
// doesn't quietly exempt a real broken link.
const PLANNED_KEYWORD = "(?:planned|new|wip|todo|deferred|removed)";
const PLANNED_MARKER_RE = new RegExp(
  `\\(${PLANNED_KEYWORD}\\)` +              // (planned), (NEW), ...
  `|\\|\\s*${PLANNED_KEYWORD}\\b` +          // | NEW [anything] |
  `|^\\s*${PLANNED_KEYWORD}\\b` +            // NEW: ... at start of line
  `|[—:]\\s*${PLANNED_KEYWORD}\\b` +         // — Deferred ..., : Planned ...
  `|\\bto be (?:created|written|added|implemented|built|shipped)\\b` +
  `|\\bwill be (?:created|written|added|implemented|shipped|built)\\b` +
  `|\\bcoming in (?:Lap|Wave|Q[1-4]|Day|Phase)\\b` +
  // Standalone "deferred" anywhere on the line — specific enough that it
  // doesn't trigger on prose. Same for explicit "Day NN prep step" /
  // "Day NN deliverable" / "needs to be (created|written|added)" phrases.
  `|\\bdeferred\\b` +
  `|\\bDay \\d+ (?:prep|deliverable|step|spec)\\b` +
  `|\\bneeds to be (?:created|written|added|implemented|built)\\b` +
  // Inline-only references: a doc may cite an ADR or section that lives
  // inline in the same file rather than as a standalone document.
  `|\\b(?:inlined?|cross-reference)\\b` +
  // Explicit migration / removed pointers to phased-out files.
  `|\\b(?:moved to|renamed to|superseded by|replaced by|see also)\\b` +
  // Date placeholders like 2026-06-XX (XX = TBD) are explicit "not yet".
  `|\\d{4}-\\d{2}-XX\\b`,
  "i",
);

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

function lineContaining(text: string, charIndex: number): string {
  // Returns the line of `text` that contains the byte at charIndex.
  const start = text.lastIndexOf("\n", charIndex - 1) + 1;
  const end = text.indexOf("\n", charIndex);
  return text.slice(start, end < 0 ? text.length : end);
}

function isPlanned(line: string): boolean {
  return PLANNED_MARKER_RE.test(line);
}

function main() {
  const files = listMarkdownFiles(DOCS_DIR);
  const broken: Issue[] = [];
  let totalLinks = 0;
  let totalCites = 0;
  let plannedSkips = 0;

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");

    // Markdown links
    for (const match of text.matchAll(LINK_RE)) {
      const href = match[2];
      if (isExternal(href)) continue;
      totalLinks++;
      const { ok, resolved } = checkLink(file, href);
      if (!ok) {
        if (isPlanned(lineContaining(text, match.index ?? 0))) {
          plannedSkips++;
          continue;
        }
        broken.push({ file, raw: href, resolved });
      }
    }

    // Inline-code citations into the repo
    for (const match of text.matchAll(CITE_RE)) {
      const citePath = match[1];
      totalCites++;
      const { ok, resolved } = checkCite(citePath);
      if (!ok) {
        if (isPlanned(lineContaining(text, match.index ?? 0))) {
          plannedSkips++;
          continue;
        }
        broken.push({ file, raw: match[0], resolved });
      }
    }
  }

  if (plannedSkips > 0) {
    console.log(`(${plannedSkips} cites skipped — line marked planned/NEW/WIP/TODO/deferred/removed)`);
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
