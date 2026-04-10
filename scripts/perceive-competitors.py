#!/usr/bin/env python3
"""
perceive-competitors.py — Competitive Landscape Perception Agent

Fetches competitor feature pages to understand what the market offers.
Targets:
  - Procore (https://www.procore.com/features)
  - Fieldwire (https://www.fieldwire.com/features)
  - Autodesk Construction Cloud (https://construction.autodesk.com/products)

Extracts feature lists and key capabilities from public-facing pages.
All failures are handled gracefully — partial data is still useful.

Outputs: .perception/competitive-state.json
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone

OUTPUT_DIR = ".perception"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "competitive-state.json")

# Competitor targets with fallback URLs
COMPETITORS = [
    {
        "name": "Procore",
        "urls": [
            "https://www.procore.com/features",
            "https://www.procore.com/platform",
        ],
        "known_features": [
            "Project Management", "Quality & Safety", "Financial Management",
            "Preconstruction", "Workforce Management", "BIM",
            "RFIs", "Submittals", "Change Orders", "Daily Log",
            "Punch List", "Budget Tracking", "Schedule",
            "Document Management", "Drawings", "Photos",
        ],
    },
    {
        "name": "Fieldwire",
        "urls": [
            "https://www.fieldwire.com/features",
            "https://www.fieldwire.com",
        ],
        "known_features": [
            "Task Management", "Plan Viewing", "Punch Lists",
            "Inspections", "Scheduling", "Forms",
            "Daily Reports", "Photos", "BIM Viewer",
            "RFIs", "Submittals", "Floorplan Markup",
        ],
    },
    {
        "name": "Autodesk Construction Cloud",
        "urls": [
            "https://construction.autodesk.com/products",
            "https://construction.autodesk.com",
        ],
        "known_features": [
            "BIM Collaborate", "Build", "Takeoff", "PlanGrid",
            "Docs", "Design", "Quantify", "Model Coordination",
            "Document Management", "RFIs", "Submittals",
            "Issues", "Daily Log", "Photos", "Checklists",
        ],
    },
]


def fetch_url(url: str, timeout: int = 15) -> str:
    """Fetch a URL using requests or urllib as fallback. Returns page text or empty string."""
    # Try requests first
    try:
        import requests
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()
        return resp.text
    except ImportError:
        pass
    except Exception:
        pass

    # Fallback to urllib
    try:
        from urllib.request import Request, urlopen
        req = Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; research-bot/1.0)",
        })
        with urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="ignore")
    except Exception:
        pass

    return ""


def extract_features_from_html(html: str) -> list:
    """Extract feature names from HTML using simple heuristics."""
    if not html:
        return []

    features = set()

    # Try BeautifulSoup if available
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")

        # Feature headings (h2, h3, h4)
        for heading in soup.find_all(["h2", "h3", "h4"]):
            text = heading.get_text(strip=True)
            if 3 < len(text) < 80 and not text.startswith(("©", "Cookie", "Privacy")):
                features.add(text)

        # Feature list items in feature-related sections
        for li in soup.find_all("li"):
            text = li.get_text(strip=True)
            if 5 < len(text) < 60:
                # Skip navigation items
                parent_class = " ".join(li.parent.get("class", []))
                if "nav" not in parent_class.lower() and "footer" not in parent_class.lower():
                    features.add(text)

        # Feature cards (common pattern)
        for card in soup.find_all(attrs={"class": re.compile(r"feature|card|product", re.I)}):
            heading = card.find(["h2", "h3", "h4", "strong"])
            if heading:
                text = heading.get_text(strip=True)
                if 3 < len(text) < 80:
                    features.add(text)

        return sorted(list(features))[:50]

    except ImportError:
        pass

    # Fallback: regex-based extraction
    # Extract text from heading tags
    heading_pattern = re.compile(r"<h[2-4][^>]*>(.*?)</h[2-4]>", re.IGNORECASE | re.DOTALL)
    for match in heading_pattern.finditer(html):
        text = re.sub(r"<[^>]+>", "", match.group(1)).strip()
        if 3 < len(text) < 80:
            features.add(text)

    return sorted(list(features))[:50]


def analyze_competitor(competitor: dict) -> dict:
    """Fetch and analyze a single competitor."""
    result = {
        "name": competitor["name"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "unknown",
        "url_fetched": None,
        "features_extracted": [],
        "known_features": competitor["known_features"],
        "page_size_bytes": 0,
    }

    # Try each URL until one works
    for url in competitor["urls"]:
        print(f"  Trying {url}...")
        html = fetch_url(url)
        if html and len(html) > 1000:
            result["url_fetched"] = url
            result["page_size_bytes"] = len(html)
            result["features_extracted"] = extract_features_from_html(html)
            result["status"] = "ok"
            print(f"    Fetched {len(html)} bytes, extracted {len(result['features_extracted'])} features")
            break
        else:
            print(f"    Failed or too small ({len(html)} bytes)")
            time.sleep(1)  # Be polite between retries

    if result["status"] != "ok":
        result["status"] = "failed"
        result["features_extracted"] = []
        print(f"    All URLs failed — using known features only")

    # Merge extracted with known (union)
    all_features = sorted(set(result["features_extracted"] + result["known_features"]))
    result["all_features"] = all_features
    result["feature_count"] = len(all_features)

    return result


def main():
    """Analyze all competitors and write results."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Analyzing competitive landscape...")

    competitors_data = []
    for competitor in COMPETITORS:
        print(f"\nAnalyzing {competitor['name']}...")
        data = analyze_competitor(competitor)
        competitors_data.append(data)

    # Compile summary
    state = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "competitors_analyzed": len(competitors_data),
        "competitors_ok": sum(1 for c in competitors_data if c["status"] == "ok"),
        "competitors": competitors_data,
        "common_features": _find_common_features(competitors_data),
        "market_table_stakes": [
            "RFIs", "Submittals", "Change Orders", "Daily Log",
            "Punch List", "Budget/Cost", "Schedule", "Document Management",
            "Photos", "Drawings/Plans",
        ],
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(state, f, indent=2)

    print(f"\nCompetitive perception complete. Written to {OUTPUT_FILE}")
    print(f"Competitors analyzed: {state['competitors_ok']}/{state['competitors_analyzed']}")


def _find_common_features(competitors: list) -> list:
    """Find features that appear in all competitors."""
    if not competitors:
        return []

    # Normalize feature names for comparison
    def normalize(s):
        return re.sub(r"[^a-z0-9]", "", s.lower())

    all_normalized = []
    for c in competitors:
        normalized = {normalize(f): f for f in c.get("all_features", [])}
        all_normalized.append(normalized)

    if not all_normalized:
        return []

    # Features in at least 2 competitors
    common = []
    all_keys = set()
    for n in all_normalized:
        all_keys.update(n.keys())

    for key in all_keys:
        count = sum(1 for n in all_normalized if key in n)
        if count >= 2:
            # Use the first competitor's version of the name
            for n in all_normalized:
                if key in n:
                    common.append(n[key])
                    break

    return sorted(common)


if __name__ == "__main__":
    main()
