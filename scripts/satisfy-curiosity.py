#!/usr/bin/env python3
"""
satisfy-curiosity.py — Autonomous Research Triggered by Knowledge Gaps

Identifies knowledge gaps from the world model, reflection, and strategic direction,
then attempts to fill them by fetching relevant documentation and resources.
Saves actionable findings to .agent/curiosity-findings.json.

Usage:
    python senses/scripts/satisfy-curiosity.py [--repo-root /path/to/repo] [--max-gaps 5]

Called during the perception phase of perceive-and-reason.yml.
"""

import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
import ssl
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_REPO_ROOT = os.getcwd()
WORLD_MODEL_PATH = ".agent/world-model.json"
REFLECTION_PATH = "REFLECTION.md"
TONIGHT_PATH = "TONIGHT.md"
EVOLUTION_LEDGER_PATH = "EVOLUTION_LEDGER.json"
OUTPUT_PATH = ".agent/curiosity-findings.json"

MAX_GAPS_DEFAULT = 5
FETCH_TIMEOUT = 15  # seconds per URL fetch
MAX_CONTENT_LENGTH = 8000  # chars to extract per page

# Reliable documentation sources, keyed by topic
KNOWN_SOURCES = {
    "supabase": [
        "https://supabase.com/docs/guides/functions/quickstart",
        "https://supabase.com/docs/guides/auth/quickstarts/react",
        "https://supabase.com/docs/reference/javascript/introduction",
        "https://supabase.com/docs/guides/database/overview",
        "https://supabase.com/docs/guides/realtime",
    ],
    "react": [
        "https://react.dev/reference/react",
        "https://react.dev/learn/thinking-in-react",
        "https://tanstack.com/query/latest/docs/react/overview",
    ],
    "vite": [
        "https://vite.dev/guide/",
        "https://vite.dev/config/",
    ],
    "construction": [
        "https://www.procore.com/library",
        "https://constructionblog.autodesk.com/",
    ],
    "testing": [
        "https://vitest.dev/guide/",
        "https://playwright.dev/docs/intro",
    ],
    "tailwind": [
        "https://tailwindcss.com/docs/installation",
    ],
    "typescript": [
        "https://www.typescriptlang.org/docs/handbook/2/types-from-types.html",
    ],
}


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def load_json(path: str) -> Optional[dict]:
    """Load a JSON file, returning None if it doesn't exist or is malformed."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, PermissionError):
        return None


def save_json(path: str, data: dict) -> None:
    """Save data as formatted JSON."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)


def read_text(path: str) -> Optional[str]:
    """Read a text file, returning None if missing."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except (FileNotFoundError, PermissionError):
        return None


def today_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# HTML text extraction (minimal, no external dependencies)
# ---------------------------------------------------------------------------

class TextExtractor(HTMLParser):
    """Extract readable text from HTML, ignoring scripts and styles."""

    def __init__(self):
        super().__init__()
        self._text_parts: list[str] = []
        self._skip_tags = {"script", "style", "noscript", "svg", "head"}
        self._skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag.lower() in self._skip_tags:
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag.lower() in self._skip_tags and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data):
        if self._skip_depth == 0:
            text = data.strip()
            if text:
                self._text_parts.append(text)

    def get_text(self) -> str:
        return "\n".join(self._text_parts)


def extract_text_from_html(html: str) -> str:
    """Extract readable text from HTML content."""
    extractor = TextExtractor()
    try:
        extractor.feed(html)
    except Exception:
        # Fallback: strip tags with regex
        return re.sub(r"<[^>]+>", " ", html)
    return extractor.get_text()


# ---------------------------------------------------------------------------
# URL fetching (using urllib — no external dependencies)
# ---------------------------------------------------------------------------

def fetch_url(url: str) -> Optional[str]:
    """Fetch a URL and return its text content. Returns None on failure."""
    try:
        # Create SSL context that doesn't verify (for CI environments)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "SiteSync-PM-Curiosity/1.0 (autonomous builder research)",
                "Accept": "text/html,application/json,text/plain",
            },
        )
        with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT, context=ctx) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read(200_000)  # Max 200KB

            # Decode
            encoding = "utf-8"
            if "charset=" in content_type:
                encoding = content_type.split("charset=")[-1].split(";")[0].strip()
            text = raw.decode(encoding, errors="replace")

            # Extract text if HTML
            if "html" in content_type.lower():
                text = extract_text_from_html(text)

            return text[:MAX_CONTENT_LENGTH]

    except Exception as e:
        print(f"  [curiosity] Failed to fetch {url}: {e}")
        return None


def fetch_with_curl(url: str) -> Optional[str]:
    """Fallback: use curl if urllib fails."""
    try:
        result = subprocess.run(
            ["curl", "-sL", "--max-time", str(FETCH_TIMEOUT), "-k", url],
            capture_output=True,
            text=True,
            timeout=FETCH_TIMEOUT + 5,
        )
        if result.returncode == 0 and result.stdout:
            text = result.stdout
            if "<html" in text.lower():
                text = extract_text_from_html(text)
            return text[:MAX_CONTENT_LENGTH]
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return None


def fetch_content(url: str) -> Optional[str]:
    """Fetch URL content, trying urllib first then curl as fallback."""
    content = fetch_url(url)
    if content is None:
        content = fetch_with_curl(url)
    return content


# ---------------------------------------------------------------------------
# Knowledge gap identification
# ---------------------------------------------------------------------------

def identify_gaps_from_reflection(reflection: Optional[str]) -> list[dict]:
    """Extract knowledge gaps from the builder's reflection."""
    gaps = []
    if not reflection:
        return gaps

    # Patterns that indicate the builder needed knowledge it didn't have
    gap_patterns = [
        (r"(?:didn't know|don't know|unsure|unclear)\s+(?:how to|what|why|whether)\s+(.+?)(?:\.|$)",
         "knowledge_gap"),
        (r"(?:struggled? with|couldn't figure out|failed? to)\s+(.+?)(?:\.|$)",
         "capability_gap"),
        (r"(?:need(?:s|ed)? to (?:learn|understand|figure out|research))\s+(.+?)(?:\.|$)",
         "explicit_need"),
        (r"(?:blocked by|blocker[:\s]+)\s*(.+?)(?:\.|$)",
         "blocker"),
        (r"(?:wish I|would help to|should have|next time)\s+(.+?)(?:\.|$)",
         "aspiration"),
    ]

    for pattern, gap_type in gap_patterns:
        matches = re.findall(pattern, reflection, re.IGNORECASE | re.MULTILINE)
        for match in matches[:3]:
            gaps.append({
                "raw_text": match.strip(),
                "type": gap_type,
                "source": "reflection",
            })

    return gaps


def identify_gaps_from_world_model(world_model: Optional[dict]) -> list[dict]:
    """Identify knowledge gaps from the accumulated world model."""
    gaps = []
    if not world_model:
        return gaps

    # Gap: Pages stuck for 3+ nights
    stuck_pages = world_model.get("derived_insights", {}).get("stuck_pages", [])
    if stuck_pages:
        pages_str = ", ".join(stuck_pages[:5])
        gaps.append({
            "raw_text": f"Pages stuck for 3+ nights: {pages_str}",
            "type": "stuck_page",
            "source": "world_model",
        })

    # Gap: Recurring problems with unknown root cause
    problems = world_model.get("technical_understanding", {}).get("recurring_problems", [])
    for problem in problems[:3]:
        if problem.get("root_cause") in ("unknown", "from reflection", ""):
            gaps.append({
                "raw_text": problem.get("pattern", ""),
                "type": "unsolved_problem",
                "source": "world_model",
            })

    # Gap: Features with blockers
    features = world_model.get("product_understanding", {}).get("features", {})
    for fname, fdata in list(features.items())[:5]:
        if fdata.get("blocker"):
            gaps.append({
                "raw_text": f"{fname}: {fdata['blocker']}",
                "type": "feature_blocker",
                "source": "world_model",
            })

    # Gap: Low demo readiness in specific scenes
    scenes = world_model.get("product_understanding", {}).get("demo_readiness", {}).get("scene_scores", {})
    for scene, score in scenes.items():
        if isinstance(score, (int, float)) and score <= 2:
            gaps.append({
                "raw_text": f"Demo scene '{scene}' scored {score}/10 — needs improvement strategy",
                "type": "demo_gap",
                "source": "world_model",
            })

    return gaps


def identify_gaps_from_tonight(tonight: Optional[str]) -> list[dict]:
    """Identify knowledge gaps implied by tonight's strategic direction."""
    gaps = []
    if not tonight:
        return gaps

    # Look for technology mentions that might need research
    tech_patterns = [
        (r"(?:wire|connect|implement|add)\s+(?:the\s+)?(.+?)\s+(?:to|with|for)\s+(.+?)(?:\.|$)",
         "implementation_pattern"),
        (r"(?:build|create|add)\s+(?:a\s+)?(.+?)(?:component|page|feature|view)(?:\.|$)",
         "component_need"),
    ]

    for pattern, gap_type in tech_patterns:
        matches = re.findall(pattern, tonight, re.IGNORECASE | re.MULTILINE)
        for match in matches[:2]:
            if isinstance(match, tuple):
                match = " ".join(match)
            gaps.append({
                "raw_text": match.strip(),
                "type": gap_type,
                "source": "tonight",
            })

    return gaps


# ---------------------------------------------------------------------------
# Gap classification and URL selection
# ---------------------------------------------------------------------------

def classify_gap(gap: dict) -> dict:
    """Classify a knowledge gap and determine the best research approach."""
    text = gap.get("raw_text", "").lower()

    # Determine topic and URLs to check
    topic = "general"
    urls = []
    search_query = gap["raw_text"]

    # Supabase-related
    if any(kw in text for kw in ["supabase", "edge function", "database", "rls", "auth", "realtime", "row level"]):
        topic = "supabase"
        urls = list(KNOWN_SOURCES["supabase"])
        if "edge function" in text:
            urls.insert(0, "https://supabase.com/docs/guides/functions/quickstart")
        elif "auth" in text:
            urls.insert(0, "https://supabase.com/docs/guides/auth/quickstarts/react")
        elif "realtime" in text:
            urls.insert(0, "https://supabase.com/docs/guides/realtime")

    # React-related
    elif any(kw in text for kw in ["react", "hook", "usequery", "component", "useState", "tanstack", "router"]):
        topic = "react"
        urls = list(KNOWN_SOURCES["react"])

    # Testing-related
    elif any(kw in text for kw in ["test", "vitest", "playwright", "coverage", "e2e"]):
        topic = "testing"
        urls = list(KNOWN_SOURCES["testing"])

    # Construction domain
    elif any(kw in text for kw in ["construction", "superintendent", "rfi", "submittal", "procore",
                                     "schedule", "gantt", "punch list", "daily log"]):
        topic = "construction"
        urls = list(KNOWN_SOURCES["construction"])
        # Add npm search for UI components
        if any(kw in text for kw in ["gantt", "schedule", "chart"]):
            component = "gantt" if "gantt" in text else "schedule"
            urls.append(f"https://www.npmjs.com/search?q=react+{component}")

    # Vite-related
    elif any(kw in text for kw in ["vite", "build", "bundle", "hmr"]):
        topic = "vite"
        urls = list(KNOWN_SOURCES["vite"])

    # TypeScript-related
    elif any(kw in text for kw in ["typescript", "type", "generic", "as any"]):
        topic = "typescript"
        urls = list(KNOWN_SOURCES["typescript"])

    # Tailwind-related
    elif any(kw in text for kw in ["tailwind", "css", "style", "responsive", "mobile"]):
        topic = "tailwind"
        urls = list(KNOWN_SOURCES["tailwind"])

    return {
        **gap,
        "topic": topic,
        "urls_to_check": urls[:3],  # Max 3 URLs per gap
        "search_query": search_query,
    }


# ---------------------------------------------------------------------------
# Research execution
# ---------------------------------------------------------------------------

def research_gap(classified_gap: dict) -> dict:
    """Attempt to fill a knowledge gap by fetching and analyzing content."""
    gap_text = classified_gap["raw_text"]
    urls = classified_gap.get("urls_to_check", [])

    print(f"  [curiosity] Researching: {gap_text[:80]}")

    findings = []

    for url in urls:
        print(f"    Fetching: {url}")
        content = fetch_content(url)
        if content is None:
            continue

        # Extract the most relevant section
        insight = extract_relevant_insight(content, gap_text)
        if insight:
            findings.append({
                "source": url,
                "insight": insight,
            })
            # One good finding per gap is enough
            break

    # Build the result
    if findings:
        best = findings[0]
        return {
            "gap": gap_text,
            "topic": classified_gap.get("topic", "general"),
            "source": best["source"],
            "insight": best["insight"],
            "applies_to": classified_gap.get("source", "general"),
            "resolved": True,
        }
    else:
        return {
            "gap": gap_text,
            "topic": classified_gap.get("topic", "general"),
            "source": None,
            "insight": f"Could not find specific guidance. Consider searching: {gap_text}",
            "applies_to": classified_gap.get("source", "general"),
            "resolved": False,
        }


def extract_relevant_insight(content: str, gap_text: str) -> Optional[str]:
    """Extract the most relevant insight from fetched content for a given gap."""
    if not content or len(content.strip()) < 50:
        return None

    # Split into paragraphs
    paragraphs = [p.strip() for p in content.split("\n") if p.strip() and len(p.strip()) > 30]

    if not paragraphs:
        return None

    # Score paragraphs by keyword overlap with the gap
    gap_words = set(gap_text.lower().split())
    # Remove common words
    stop_words = {"the", "a", "an", "is", "are", "was", "were", "to", "for", "in", "on", "with", "and", "or", "but", "not", "it", "this", "that", "how", "what", "why"}
    gap_words -= stop_words

    scored = []
    for para in paragraphs:
        para_lower = para.lower()
        score = sum(1 for word in gap_words if word in para_lower)
        # Boost paragraphs with code examples
        if "```" in para or "import " in para or "const " in para or "function " in para:
            score += 2
        # Boost paragraphs that look like instructions
        if any(kw in para_lower for kw in ["use ", "call ", "invoke", "create", "add ", "import ", "install"]):
            score += 1
        scored.append((score, para))

    # Sort by relevance score
    scored.sort(key=lambda x: x[0], reverse=True)

    # Take top 3 most relevant paragraphs
    top_paragraphs = [p for _, p in scored[:3] if _ > 0]

    if not top_paragraphs:
        # Fall back to first few substantive paragraphs
        top_paragraphs = paragraphs[:3]

    insight = "\n".join(top_paragraphs)

    # Truncate to reasonable length
    if len(insight) > 1000:
        insight = insight[:1000] + "..."

    return insight


# ---------------------------------------------------------------------------
# Gap prioritization
# ---------------------------------------------------------------------------

def prioritize_gaps(gaps: list[dict], tonight: Optional[str]) -> list[dict]:
    """Prioritize gaps, putting tonight's direction-blocking gaps first."""
    tonight_lower = (tonight or "").lower()

    def priority_score(gap: dict) -> int:
        score = 0
        text = gap.get("raw_text", "").lower()

        # Higher priority if it relates to tonight's direction
        if tonight_lower:
            gap_words = set(text.split()) - {"the", "a", "an", "to", "for", "in", "on"}
            for word in gap_words:
                if word in tonight_lower and len(word) > 3:
                    score += 3

        # Priority by type
        type_scores = {
            "feature_blocker": 5,
            "blocker": 5,
            "capability_gap": 4,
            "implementation_pattern": 4,
            "knowledge_gap": 3,
            "stuck_page": 3,
            "unsolved_problem": 3,
            "demo_gap": 4,
            "explicit_need": 2,
            "component_need": 2,
            "aspiration": 1,
        }
        score += type_scores.get(gap.get("type", ""), 1)

        return score

    # Deduplicate by similarity
    seen_texts = set()
    unique_gaps = []
    for gap in gaps:
        normalized = gap.get("raw_text", "").lower().strip()[:50]
        if normalized not in seen_texts:
            seen_texts.add(normalized)
            unique_gaps.append(gap)

    # Sort by priority
    unique_gaps.sort(key=priority_score, reverse=True)
    return unique_gaps


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_curiosity(repo_root: str, max_gaps: int) -> dict:
    """Identify knowledge gaps and attempt to fill them."""

    print("[curiosity] Starting autonomous research...")

    # 1. Read inputs
    world_model = load_json(os.path.join(repo_root, WORLD_MODEL_PATH))
    reflection = read_text(os.path.join(repo_root, REFLECTION_PATH))
    tonight = read_text(os.path.join(repo_root, TONIGHT_PATH))

    print(f"[curiosity] World model: {'loaded' if world_model else 'not found'}")
    print(f"[curiosity] Reflection: {'loaded' if reflection else 'not found'}")
    print(f"[curiosity] Tonight direction: {'loaded' if tonight else 'not found'}")

    # 2. Identify all knowledge gaps
    all_gaps = []
    all_gaps.extend(identify_gaps_from_reflection(reflection))
    all_gaps.extend(identify_gaps_from_world_model(world_model))
    all_gaps.extend(identify_gaps_from_tonight(tonight))

    print(f"[curiosity] Raw gaps identified: {len(all_gaps)}")

    if not all_gaps:
        print("[curiosity] No knowledge gaps identified. The builder seems well-informed.")
        result = {
            "date": today_iso(),
            "timestamp": now_iso(),
            "gaps_identified": 0,
            "gaps_resolved": 0,
            "findings": [],
            "note": "No knowledge gaps identified from reflection, world model, or strategic direction.",
        }
        save_json(os.path.join(repo_root, OUTPUT_PATH), result)
        return result

    # 3. Prioritize gaps (tonight's direction gets highest priority)
    prioritized = prioritize_gaps(all_gaps, tonight)
    selected = prioritized[:max_gaps]

    print(f"[curiosity] Selected {len(selected)} gaps to research (of {len(prioritized)} total):")
    for i, gap in enumerate(selected):
        print(f"  {i+1}. [{gap.get('type', '?')}] {gap.get('raw_text', '?')[:60]}")

    # 4. Classify and research each gap
    classified = [classify_gap(gap) for gap in selected]
    results = []
    resolved_count = 0

    for gap in classified:
        finding = research_gap(gap)
        results.append(finding)
        if finding.get("resolved"):
            resolved_count += 1

    # 5. Save findings
    output = {
        "date": today_iso(),
        "timestamp": now_iso(),
        "gaps_identified": len(prioritized),
        "gaps_selected": len(selected),
        "gaps_resolved": resolved_count,
        "findings": results,
    }

    output_path = os.path.join(repo_root, OUTPUT_PATH)
    save_json(output_path, output)

    print(f"\n[curiosity] Research complete:")
    print(f"  Gaps identified: {len(prioritized)}")
    print(f"  Gaps researched: {len(selected)}")
    print(f"  Gaps resolved:   {resolved_count}")
    print(f"  Saved to: {output_path}")

    for finding in results:
        status = "RESOLVED" if finding.get("resolved") else "UNRESOLVED"
        print(f"\n  [{status}] {finding['gap'][:60]}")
        if finding.get("source"):
            print(f"    Source: {finding['source']}")
        print(f"    Insight: {finding['insight'][:100]}...")

    return output


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Satisfy knowledge gaps for SiteSync PM autonomous builder."
    )
    parser.add_argument(
        "--repo-root",
        default=DEFAULT_REPO_ROOT,
        help="Path to the repository root (default: current directory)",
    )
    parser.add_argument(
        "--max-gaps",
        type=int,
        default=MAX_GAPS_DEFAULT,
        help=f"Maximum number of gaps to research (default: {MAX_GAPS_DEFAULT})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Identify gaps without fetching URLs",
    )
    args = parser.parse_args()

    repo_root = os.path.abspath(args.repo_root)
    if not os.path.isdir(repo_root):
        print(f"Error: Repository root not found: {repo_root}", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        # Just identify gaps, don't research
        world_model = load_json(os.path.join(repo_root, WORLD_MODEL_PATH))
        reflection = read_text(os.path.join(repo_root, REFLECTION_PATH))
        tonight = read_text(os.path.join(repo_root, TONIGHT_PATH))

        all_gaps = []
        all_gaps.extend(identify_gaps_from_reflection(reflection))
        all_gaps.extend(identify_gaps_from_world_model(world_model))
        all_gaps.extend(identify_gaps_from_tonight(tonight))

        prioritized = prioritize_gaps(all_gaps, tonight)
        print(f"\n--- DRY RUN: {len(prioritized)} gaps identified ---")
        for i, gap in enumerate(prioritized[:args.max_gaps]):
            classified = classify_gap(gap)
            print(f"\n{i+1}. [{gap.get('type')}] {gap.get('raw_text')}")
            print(f"   Topic: {classified.get('topic')}")
            print(f"   URLs: {classified.get('urls_to_check', [])}")
    else:
        run_curiosity(repo_root, args.max_gaps)


if __name__ == "__main__":
    main()
