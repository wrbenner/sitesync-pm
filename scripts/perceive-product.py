#!/usr/bin/env python3
"""
perceive-product.py — Live Product Perception Agent

Visits https://sitesync-pm.vercel.app using Playwright and captures
the actual state of 8 key pages. Extracts:
  - Text content visible on each page
  - Count of interactive elements (buttons, links, inputs)
  - Count of data elements (table rows, list items, card components)
  - Empty states, error states, and loading states detected
  - Screenshot metadata (dimensions, load time)

Outputs: .perception/app-state.json

This is the system's eyes. The Strategic Mind reads this to understand
the gap between VISION_CORE.md (the ceiling) and reality (the floor).
"""

import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone

# Playwright is installed by the workflow: pip install playwright
# Browser is installed by: npx playwright install --with-deps chromium

APP_URL = os.environ.get("APP_URL", "https://sitesync-pm.vercel.app")
OUTPUT_DIR = ".perception"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "app-state.json")

# The 8 pages that define SiteSync PM's product surface
PAGES = [
    {
        "name": "Dashboard",
        "path": "/dashboard",
        "description": "GC overview — contract value, open items, project health",
        "vision": "GC sees Riverside Tower: $52M contract, risk indicators, AI insights",
    },
    {
        "name": "RFIs",
        "path": "/rfis",
        "description": "Request for Information tracking",
        "vision": "PM sees which ONE RFI will blow the schedule if unanswered today",
    },
    {
        "name": "Submittals",
        "path": "/submittals",
        "description": "Submittal tracking and approval workflow",
        "vision": "Real submittals with statuses, approval chains, due dates",
    },
    {
        "name": "Budget",
        "path": "/budget",
        "description": "Project budget and cost tracking",
        "vision": "GC sees cost trends, predicted final cost, change order impact",
    },
    {
        "name": "Daily Log",
        "path": "/daily-log",
        "description": "Field daily reports",
        "vision": "Superintendent logs conditions; system pattern-matches against history",
    },
    {
        "name": "Schedule",
        "path": "/schedule",
        "description": "Project schedule and timeline",
        "vision": "Critical path visible, float evaporation warnings, delay cascades",
    },
    {
        "name": "Punch List",
        "path": "/punch-list",
        "description": "Punch items and close-out tracking",
        "vision": "Open items grouped by trade, filterable, with aging indicators",
    },
    {
        "name": "AI Copilot",
        "path": "/copilot",
        "description": "AI assistant for project intelligence",
        "vision": "GC asks 'What is the biggest risk?' and gets a real answer about Riverside Tower",
    },
]

# Indicators of problematic states
EMPTY_STATE_INDICATORS = [
    "no data",
    "no items",
    "nothing here",
    "get started",
    "empty",
    "no results",
    "no records",
    "add your first",
    "nothing to show",
    "no entries",
]

ERROR_STATE_INDICATORS = [
    "error",
    "failed to",
    "something went wrong",
    "500",
    "404",
    "not found",
    "could not load",
    "unable to",
    "try again",
    "oops",
]

LOADING_STATE_INDICATORS = [
    "loading",
    "spinner",
    "skeleton",
    "please wait",
    "fetching",
]

MOCK_DATA_INDICATORS = [
    "lorem ipsum",
    "john doe",
    "jane doe",
    "test project",
    "sample data",
    "placeholder",
    "example.com",
    "foo bar",
    "acme",
]


async def perceive_page(page, page_config: dict) -> dict:
    """Visit a single page and extract its state."""
    url = f"{APP_URL}{page_config['path']}"
    result = {
        "name": page_config["name"],
        "path": page_config["path"],
        "url": url,
        "vision_target": page_config["vision"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    start_time = time.time()

    try:
        # Navigate with generous timeout
        response = await page.goto(url, wait_until="networkidle", timeout=30000)
        load_time_ms = round((time.time() - start_time) * 1000)
        result["load_time_ms"] = load_time_ms
        result["http_status"] = response.status if response else None

        # Wait a moment for dynamic content
        await page.wait_for_timeout(2000)

        # Extract visible text content (truncated for context efficiency)
        text_content = await page.evaluate("""
            () => {
                const body = document.body;
                if (!body) return '';
                // Remove script and style content
                const clone = body.cloneNode(true);
                clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
                return clone.innerText.substring(0, 5000);
            }
        """)
        result["text_content"] = text_content[:3000] if text_content else ""
        result["text_length"] = len(text_content) if text_content else 0

        # Count interactive elements
        interactive_count = await page.evaluate("""
            () => {
                const buttons = document.querySelectorAll('button, [role="button"]').length;
                const links = document.querySelectorAll('a[href]').length;
                const inputs = document.querySelectorAll('input, textarea, select').length;
                return { buttons, links, inputs, total: buttons + links + inputs };
            }
        """)
        result["interactive_elements"] = interactive_count

        # Count data elements (signs of real data)
        data_count = await page.evaluate("""
            () => {
                const tableRows = document.querySelectorAll('tr, [role="row"]').length;
                const listItems = document.querySelectorAll('li, [role="listitem"]').length;
                const cards = document.querySelectorAll(
                    '[class*="card"], [class*="Card"], [data-testid*="card"]'
                ).length;
                const dataValues = document.querySelectorAll(
                    '[class*="stat"], [class*="metric"], [class*="value"], [class*="count"]'
                ).length;
                return {
                    table_rows: tableRows,
                    list_items: listItems,
                    cards: cards,
                    data_values: dataValues,
                    total: tableRows + listItems + cards + dataValues
                };
            }
        """)
        result["data_elements"] = data_count

        # Detect states
        text_lower = (text_content or "").lower()

        result["detected_states"] = {
            "empty": any(indicator in text_lower for indicator in EMPTY_STATE_INDICATORS),
            "error": any(indicator in text_lower for indicator in ERROR_STATE_INDICATORS),
            "loading": any(indicator in text_lower for indicator in LOADING_STATE_INDICATORS),
            "mock_data": any(indicator in text_lower for indicator in MOCK_DATA_INDICATORS),
        }

        # Check for real data signals
        result["has_real_data"] = (
            data_count.get("total", 0) > 3
            and not result["detected_states"]["empty"]
            and not result["detected_states"]["mock_data"]
        )

        # Check for intelligence signals (AI-powered features)
        intelligence_keywords = [
            "risk", "predict", "forecast", "trend", "alert",
            "insight", "recommend", "critical path", "impact",
            "confidence", "probability", "anomaly",
        ]
        result["intelligence_signals"] = sum(
            1 for kw in intelligence_keywords if kw in text_lower
        )

        # Page dimensions
        viewport = await page.evaluate("""
            () => ({
                width: window.innerWidth,
                height: window.innerHeight,
                scrollHeight: document.body.scrollHeight
            })
        """)
        result["viewport"] = viewport

        # Console errors
        console_errors = []

        def handle_console(msg):
            if msg.type == "error":
                console_errors.append(msg.text[:200])

        page.on("console", handle_console)
        await page.wait_for_timeout(1000)
        result["console_errors"] = console_errors[:5]
        result["console_error_count"] = len(console_errors)

        result["status"] = "ok"

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)[:500]
        result["load_time_ms"] = round((time.time() - start_time) * 1000)

    return result


async def main():
    """Perceive all pages and write the app state."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("ERROR: playwright not installed. Run: pip install playwright")
        # Write a minimal state so downstream doesn't fail
        with open(OUTPUT_FILE, "w") as f:
            json.dump({"error": "playwright not installed", "pages": []}, f)
        sys.exit(1)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="SiteSync-Autopoietic-Perception/1.0",
        )

        page = await context.new_page()
        page_states = []

        for page_config in PAGES:
            print(f"Perceiving: {page_config['name']} ({page_config['path']})...")
            state = await perceive_page(page, page_config)
            page_states.append(state)
            print(
                f"  Status: {state['status']}, "
                f"Data elements: {state.get('data_elements', {}).get('total', 'N/A')}, "
                f"Load time: {state.get('load_time_ms', 'N/A')}ms"
            )

        await browser.close()

    # Compile summary
    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "app_url": APP_URL,
        "pages_attempted": len(PAGES),
        "pages_ok": sum(1 for p in page_states if p["status"] == "ok"),
        "pages_with_real_data": sum(1 for p in page_states if p.get("has_real_data")),
        "pages_empty": sum(
            1 for p in page_states if p.get("detected_states", {}).get("empty")
        ),
        "pages_with_errors": sum(
            1 for p in page_states if p.get("detected_states", {}).get("error")
        ),
        "pages_with_intelligence": sum(
            1 for p in page_states if p.get("intelligence_signals", 0) > 0
        ),
        "total_data_elements": sum(
            p.get("data_elements", {}).get("total", 0) for p in page_states
        ),
        "total_interactive_elements": sum(
            p.get("interactive_elements", {}).get("total", 0) for p in page_states
        ),
        "avg_load_time_ms": round(
            sum(p.get("load_time_ms", 0) for p in page_states) / max(len(page_states), 1)
        ),
        "pages": page_states,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\nPerception complete. Written to {OUTPUT_FILE}")
    print(f"Pages OK: {summary['pages_ok']}/{summary['pages_attempted']}")
    print(f"Pages with real data: {summary['pages_with_real_data']}")
    print(f"Pages with intelligence: {summary['pages_with_intelligence']}")
    print(f"Average load time: {summary['avg_load_time_ms']}ms")


if __name__ == "__main__":
    asyncio.run(main())
