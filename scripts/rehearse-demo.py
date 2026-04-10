#!/usr/bin/env python3
"""
rehearse-demo.py — The Most Important Script in the System

This script doesn't just visit pages — it PERFORMS the April 15 demo as a
General Contractor would experience it. It interacts with the product: clicks
buttons, fills forms, navigates workflows. Every place it gets stuck becomes
tonight's top priority.

8 Scenes. 10 minutes. The GC's entire impression of SiteSync PM.

Outputs:
  - .perception/screenshots/  (visual evidence at key moments)
  - .perception/demo-rehearsal.json  (structured scene-by-scene results)
  - .perception/demo-rehearsal-summary.md  (blunt human-readable report)

Usage:
  python autopoietic/scripts/rehearse-demo.py

Environment:
  APP_URL — base URL (default: https://sitesync-pm.vercel.app)
  DEMO_DATE — target demo date (default: 2026-04-15)
"""

import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

APP_URL = os.environ.get("APP_URL", "https://sitesync-pm.vercel.app")
DEMO_DATE = os.environ.get("DEMO_DATE", "2026-04-15")
OUTPUT_DIR = ".perception"
SCREENSHOT_DIR = os.path.join(OUTPUT_DIR, "screenshots")
REHEARSAL_JSON = os.path.join(OUTPUT_DIR, "demo-rehearsal.json")
REHEARSAL_MD = os.path.join(OUTPUT_DIR, "demo-rehearsal-summary.md")

# Timeouts (ms)
NAV_TIMEOUT = 30_000
ELEMENT_TIMEOUT = 5_000
AI_RESPONSE_TIMEOUT = 8_000
INTERACTION_PAUSE = 1_500  # pause after interactions to let UI settle

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class StepResult:
    """A single interaction step within a scene."""

    def __init__(self, action: str, target: str):
        self.action = action
        self.target = target
        self.success: Optional[bool] = None
        self.found: Optional[bool] = None
        self.detail: str = ""
        self.screenshot_taken: bool = False
        self.duration_ms: int = 0

    def to_dict(self) -> dict:
        d = {"action": self.action, "target": self.target}
        if self.success is not None:
            d["success"] = self.success
        if self.found is not None:
            d["found"] = self.found
        if self.detail:
            d["detail"] = self.detail
        if self.screenshot_taken:
            d["screenshot_taken"] = True
        if self.duration_ms:
            d["duration_ms"] = self.duration_ms
        return d


class SceneResult:
    """The complete result of performing one demo scene."""

    def __init__(self, scene_name: str, path: str, max_score: int):
        self.scene = scene_name
        self.path = path
        self.steps: list[StepResult] = []
        self.score: int = 0
        self.max_score: int = max_score
        self.blockers: list[str] = []
        self.wins: list[str] = []
        self.verdict: str = ""
        self.auth_blocked: bool = False
        self.error: Optional[str] = None

    def add_step(self, step: StepResult):
        self.steps.append(step)

    def to_dict(self) -> dict:
        return {
            "scene": self.scene,
            "path": self.path,
            "steps": [s.to_dict() for s in self.steps],
            "score": self.score,
            "max_score": self.max_score,
            "blockers": self.blockers,
            "wins": self.wins,
            "verdict": self.verdict,
            "auth_blocked": self.auth_blocked,
            "error": self.error,
        }


async def safe_screenshot(page, name: str) -> bool:
    """Take a screenshot, swallowing errors."""
    try:
        path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
        await page.screenshot(path=path, full_page=False)
        return True
    except Exception as e:
        print(f"  [screenshot failed: {e}]")
        return False


async def safe_navigate(page, path: str, timeout: int = NAV_TIMEOUT) -> tuple[bool, int, str]:
    """
    Navigate to a path. Returns (success, http_status, detail).
    Handles auth redirects, timeouts, and network errors.
    """
    url = f"{APP_URL}{path}"
    start = time.time()
    try:
        response = await page.goto(url, wait_until="networkidle", timeout=timeout)
        duration = round((time.time() - start) * 1000)
        status = response.status if response else 0

        # Wait for dynamic content
        await page.wait_for_timeout(INTERACTION_PAUSE)

        # Detect auth redirect
        current_url = page.url
        if "/login" in current_url or "/auth" in current_url or "/signin" in current_url:
            return False, status, f"Redirected to auth wall: {current_url}"

        # Detect error pages
        title = await page.title()
        if "404" in title or "not found" in title.lower():
            return False, 404, f"Page not found (title: {title})"

        return True, status, f"Loaded in {duration}ms"

    except Exception as e:
        duration = round((time.time() - start) * 1000)
        err_msg = str(e)[:200]
        if "timeout" in err_msg.lower():
            return False, 0, f"Navigation timeout after {duration}ms"
        return False, 0, f"Navigation error: {err_msg}"


async def find_text(page, patterns: list[str], case_sensitive: bool = False) -> tuple[bool, str]:
    """
    Look for text matching any of the given patterns on the page.
    Returns (found, detail).
    """
    try:
        text_content = await page.evaluate("""
            () => {
                const body = document.body;
                if (!body) return '';
                const clone = body.cloneNode(true);
                clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
                return clone.innerText;
            }
        """)
        if not text_content:
            return False, "Page body is empty"

        text_to_search = text_content if case_sensitive else text_content.lower()
        found_patterns = []
        for pattern in patterns:
            search_pattern = pattern if case_sensitive else pattern.lower()
            if search_pattern in text_to_search:
                found_patterns.append(pattern)

        if found_patterns:
            return True, f"Found: {', '.join(found_patterns[:5])}"
        return False, f"None of [{', '.join(patterns[:3])}...] found in page text ({len(text_content)} chars)"

    except Exception as e:
        return False, f"Error extracting text: {str(e)[:100]}"


async def find_and_click(page, selectors: list[str], description: str) -> tuple[bool, str]:
    """
    Try to find and click an element matching any of the given selectors.
    Returns (success, detail).
    """
    for selector in selectors:
        try:
            element = await page.wait_for_selector(selector, timeout=ELEMENT_TIMEOUT)
            if element:
                is_visible = await element.is_visible()
                if is_visible:
                    await element.click()
                    await page.wait_for_timeout(INTERACTION_PAUSE)
                    return True, f"Clicked element matching '{selector}'"
        except Exception:
            continue

    # Fallback: try text-based click
    for selector in selectors:
        try:
            # Try role-based selector
            element = page.get_by_role("button", name=re.compile(description, re.IGNORECASE))
            if await element.count() > 0:
                await element.first.click()
                await page.wait_for_timeout(INTERACTION_PAUSE)
                return True, f"Clicked button with text matching '{description}'"
        except Exception:
            continue

    return False, f"No clickable element found for: {description}"


async def try_fill_field(page, selectors: list[str], value: str, label: str) -> tuple[bool, str]:
    """
    Try to find an input field and fill it.
    Returns (success, detail).
    """
    for selector in selectors:
        try:
            element = await page.wait_for_selector(selector, timeout=ELEMENT_TIMEOUT)
            if element:
                is_visible = await element.is_visible()
                if is_visible:
                    await element.fill(value)
                    await page.wait_for_timeout(500)
                    return True, f"Filled '{label}' field via selector '{selector}'"
        except Exception:
            continue

    # Fallback: try placeholder or label
    try:
        element = page.get_by_placeholder(re.compile(label, re.IGNORECASE))
        if await element.count() > 0:
            await element.first.fill(value)
            return True, f"Filled field with placeholder matching '{label}'"
    except Exception:
        pass

    try:
        element = page.get_by_label(re.compile(label, re.IGNORECASE))
        if await element.count() > 0:
            await element.first.fill(value)
            return True, f"Filled field with label matching '{label}'"
    except Exception:
        pass

    return False, f"No fillable input found for '{label}'"


async def count_data_elements(page) -> dict:
    """Count signs of real data on the page."""
    try:
        return await page.evaluate("""
            () => {
                const rows = document.querySelectorAll('tr, [role="row"]').length;
                const listItems = document.querySelectorAll('li, [role="listitem"]').length;
                const cards = document.querySelectorAll(
                    '[class*="card" i], [class*="Card"], [data-testid*="card"]'
                ).length;
                const buttons = document.querySelectorAll('button, [role="button"]').length;
                const links = document.querySelectorAll('a[href]').length;
                const inputs = document.querySelectorAll('input, textarea, select').length;
                const numbers = (document.body.innerText.match(/\\$[\\d,]+/g) || []).length;
                return {
                    table_rows: rows,
                    list_items: listItems,
                    cards: cards,
                    buttons: buttons,
                    links: links,
                    inputs: inputs,
                    dollar_amounts: numbers
                };
            }
        """)
    except Exception:
        return {}


async def detect_empty_or_error(page) -> dict:
    """Detect empty states, error states, or loading states."""
    try:
        return await page.evaluate("""
            () => {
                const text = (document.body.innerText || '').toLowerCase();
                const empty_signals = ['no data', 'no items', 'nothing here', 'get started',
                    'empty', 'no results', 'no records', 'add your first', 'nothing to show',
                    'no entries', 'no rfis', 'no submittals', 'no logs'];
                const error_signals = ['error', 'failed to', 'something went wrong', '500',
                    'not found', 'could not load', 'unable to', 'oops'];
                const loading_signals = ['loading', 'please wait', 'fetching'];

                return {
                    is_empty: empty_signals.some(s => text.includes(s)),
                    empty_matches: empty_signals.filter(s => text.includes(s)),
                    is_error: error_signals.some(s => text.includes(s)),
                    error_matches: error_signals.filter(s => text.includes(s)),
                    is_loading: loading_signals.some(s => text.includes(s)),
                    loading_matches: loading_signals.filter(s => text.includes(s)),
                    text_length: text.length
                };
            }
        """)
    except Exception:
        return {"is_empty": True, "is_error": False, "is_loading": False, "text_length": 0}


# ---------------------------------------------------------------------------
# Scene Performers
# ---------------------------------------------------------------------------


async def scene_1_portfolio(page) -> SceneResult:
    """SCENE 1: First Impression — Portfolio → Project Selection"""
    scene = SceneResult("First Impression (Portfolio)", "/portfolio", max_score=12)

    # Step 1: Navigate to /portfolio (or / as fallback)
    step = StepResult("navigate", "/portfolio")
    start = time.time()
    success, status, detail = await safe_navigate(page, "/portfolio")
    step.duration_ms = round((time.time() - start) * 1000)

    if not success:
        # Fallback to root
        success, status, detail = await safe_navigate(page, "/")
        step.detail = f"Portfolio 404 → tried root. {detail}"
        step.target = "/ (fallback)"
    else:
        step.detail = detail

    step.success = success
    if "/login" in detail or "/auth" in detail:
        scene.auth_blocked = True
        step.detail += " — AUTH WALL"
    step.screenshot_taken = await safe_screenshot(page, "scene1_portfolio")
    scene.add_step(step)

    if scene.auth_blocked:
        scene.blockers.append("Auth wall blocks portfolio access")
        scene.verdict = "GC cannot even see the product without logging in. First impression is a login form."
        scene.score = 0
        return scene

    if not success:
        scene.blockers.append(f"Portfolio page failed to load: {detail}")
        scene.verdict = "GC sees nothing. The portfolio page doesn't exist or crashed."
        scene.score = 0
        return scene

    scene.score += 2  # Page loaded

    # Step 2: Look for "Riverside Tower" project
    step = StepResult("look_for", "Riverside Tower project")
    found, detail = await find_text(page, ["Riverside Tower", "riverside tower", "riverside"])
    step.found = found
    step.detail = detail
    scene.add_step(step)

    if found:
        scene.score += 3
        scene.wins.append("Riverside Tower project is visible")
    else:
        scene.blockers.append("Riverside Tower project not found on portfolio page")

    # Step 3: Look for any project list
    step = StepResult("look_for", "project list or cards")
    data = await count_data_elements(page)
    has_list = (data.get("cards", 0) + data.get("list_items", 0) + data.get("table_rows", 0)) > 0
    step.found = has_list
    step.detail = f"Cards: {data.get('cards', 0)}, List items: {data.get('list_items', 0)}, Table rows: {data.get('table_rows', 0)}"
    scene.add_step(step)

    if has_list:
        scene.score += 2
        scene.wins.append("Project list/cards are present")
    else:
        scene.blockers.append("No project list or cards visible")

    # Step 4: Try to click into a project
    step = StepResult("click", "project card or link")
    clicked, detail = await find_and_click(page, [
        'a[href*="project"]',
        'a[href*="dashboard"]',
        '[class*="card" i] a',
        '[class*="Card"] a',
        '[class*="project" i]',
        'tr:first-child td:first-child a',
        'li a[href]',
    ], "Riverside Tower")
    step.success = clicked
    step.detail = detail
    scene.add_step(step)

    if clicked:
        scene.score += 3
        scene.wins.append("Successfully navigated into a project")
        step.screenshot_taken = await safe_screenshot(page, "scene1_project_detail")
    else:
        scene.blockers.append("Cannot click into any project from portfolio")

    # Step 5: Check for empty/error states
    step = StepResult("evaluate", "page state")
    state = await detect_empty_or_error(page)
    if state.get("is_empty"):
        step.detail = f"Empty state detected: {state.get('empty_matches', [])}"
        step.success = False
        scene.blockers.append(f"Empty state shown: {', '.join(state.get('empty_matches', []))}")
    elif state.get("is_error"):
        step.detail = f"Error state detected: {state.get('error_matches', [])}"
        step.success = False
        scene.blockers.append(f"Error on page: {', '.join(state.get('error_matches', []))}")
    else:
        step.detail = f"Page has content ({state.get('text_length', 0)} chars, no empty/error signals)"
        step.success = True
        scene.score += 2
    scene.add_step(step)

    # Verdict
    if scene.score >= 10:
        scene.verdict = "Strong first impression. GC sees projects, finds Riverside Tower, navigates in. This works."
    elif scene.score >= 6:
        scene.verdict = "Decent first impression but rough edges. GC sees something but interaction is incomplete."
    elif scene.score >= 3:
        scene.verdict = "Weak first impression. GC sees a page but cannot find or interact with projects."
    else:
        scene.verdict = "GC would close the tab. Nothing to see, nothing to click."

    return scene


async def scene_2_dashboard(page) -> SceneResult:
    """SCENE 2: Project Overview (Dashboard)"""
    scene = SceneResult("Project Overview (Dashboard)", "/dashboard", max_score=15)

    # Step 1: Navigate
    step = StepResult("navigate", "/dashboard")
    success, status, detail = await safe_navigate(page, "/dashboard")
    step.success = success
    step.detail = detail
    step.screenshot_taken = await safe_screenshot(page, "scene2_dashboard")
    scene.add_step(step)

    if "/login" in detail or "/auth" in detail:
        scene.auth_blocked = True
        scene.blockers.append("Auth wall blocks dashboard access")
        scene.verdict = "Dashboard requires login. GC sees nothing."
        scene.score = 0
        return scene

    if not success:
        scene.blockers.append(f"Dashboard failed to load: {detail}")
        scene.verdict = "Dashboard page crashed or doesn't exist."
        scene.score = 0
        return scene

    scene.score += 2

    # Step 2: Look for key metrics
    metrics_to_find = {
        "contract value": ["$52", "$52M", "contract value", "contract amount", "$52,000,000"],
        "open RFIs": ["open rfi", "rfi", "rfis"],
        "open submittals": ["submittal", "submittals", "pending submittal"],
        "schedule status": ["schedule", "on track", "behind schedule", "ahead", "critical path", "milestone"],
    }

    metrics_found = 0
    for metric_name, patterns in metrics_to_find.items():
        step = StepResult("look_for", metric_name)
        found, detail = await find_text(page, patterns)
        step.found = found
        step.detail = detail
        scene.add_step(step)
        if found:
            metrics_found += 1
            scene.wins.append(f"'{metric_name}' visible on dashboard")
        else:
            scene.blockers.append(f"'{metric_name}' not found on dashboard")

    scene.score += min(6, metrics_found * 2)  # Up to 6 points for metrics

    # Step 3: Check for dollar amounts (sign of real data)
    step = StepResult("look_for", "dollar amounts / real numbers")
    data = await count_data_elements(page)
    dollar_count = data.get("dollar_amounts", 0)
    step.found = dollar_count > 0
    step.detail = f"Dollar amounts on page: {dollar_count}, Cards: {data.get('cards', 0)}"
    scene.add_step(step)

    if dollar_count > 0:
        scene.score += 2
        scene.wins.append(f"{dollar_count} dollar amounts visible — looks like real financial data")
    else:
        scene.blockers.append("No dollar amounts visible — dashboard has no financial data")

    # Step 4: Try to click on a card/widget
    step = StepResult("click", "dashboard card or widget")
    clicked, detail = await find_and_click(page, [
        '[class*="card" i] a',
        '[class*="card" i] button',
        '[class*="widget" i]',
        '[class*="stat" i]',
        '[class*="metric" i]',
        'a[href*="rfi"]',
        'a[href*="budget"]',
    ], "dashboard widget")
    step.success = clicked
    step.detail = detail
    scene.add_step(step)

    if clicked:
        scene.score += 3
        scene.wins.append("Dashboard cards are interactive — drill-down works")
        step.screenshot_taken = await safe_screenshot(page, "scene2_drilldown")
    else:
        scene.blockers.append("Dashboard cards are not clickable — no drill-down possible")

    # Step 5: Overall data presence
    step = StepResult("evaluate", "data richness")
    state = await detect_empty_or_error(page)
    if state.get("is_empty"):
        step.detail = f"Dashboard shows empty state: {state.get('empty_matches', [])}"
        step.success = False
        scene.blockers.append("Dashboard is empty — no project data displayed")
    elif data.get("cards", 0) == 0 and data.get("table_rows", 0) == 0:
        step.detail = "No cards or tables found — dashboard appears to be a shell"
        step.success = False
        scene.blockers.append("Dashboard is a shell — no structured data components")
    else:
        step.detail = f"Dashboard has structure: {data.get('cards', 0)} cards, {data.get('table_rows', 0)} rows"
        step.success = True
        scene.score += 2

    scene.add_step(step)

    # Verdict
    if scene.score >= 12:
        scene.verdict = "Dashboard is demo-ready. GC sees real project data, meaningful numbers, and can drill down."
    elif scene.score >= 8:
        scene.verdict = "Dashboard has content but is incomplete. Some metrics present, interaction limited."
    elif scene.score >= 4:
        scene.verdict = "Dashboard exists but feels empty. GC would see a layout with no real data."
    else:
        scene.verdict = "GC would see empty cards or placeholder layout. No data, no interaction. Would close tab."

    return scene


async def scene_3_rfis(page) -> SceneResult:
    """SCENE 3: Document Management (RFIs)"""
    scene = SceneResult("Document Management (RFIs)", "/rfis", max_score=15)

    # Step 1: Navigate
    step = StepResult("navigate", "/rfis")
    success, status, detail = await safe_navigate(page, "/rfis")
    step.success = success
    step.detail = detail
    step.screenshot_taken = await safe_screenshot(page, "scene3_rfis")
    scene.add_step(step)

    if not success:
        scene.auth_blocked = "/login" in detail or "/auth" in detail
        scene.blockers.append(f"RFI page failed to load: {detail}")
        scene.verdict = "RFI page doesn't exist or requires auth."
        return scene

    scene.score += 2

    # Step 2: Look for RFI list with status indicators
    step = StepResult("look_for", "RFI list with status indicators")
    found_list, detail_list = await find_text(page, [
        "rfi-", "RFI-", "open", "closed", "pending", "in review",
        "approved", "responded", "overdue"
    ])
    data = await count_data_elements(page)
    has_list = data.get("table_rows", 0) > 1 or data.get("list_items", 0) > 1 or data.get("cards", 0) > 1
    step.found = found_list and has_list
    step.detail = f"Status text: {detail_list}. Rows: {data.get('table_rows', 0)}, Cards: {data.get('cards', 0)}"
    scene.add_step(step)

    if found_list and has_list:
        scene.score += 3
        scene.wins.append("RFI list with status indicators is present")
    elif has_list:
        scene.score += 1
        scene.blockers.append("RFI list exists but status indicators unclear")
    else:
        scene.blockers.append("No RFI list visible")

    # Step 3: Try to click on an RFI
    step = StepResult("click", "individual RFI")
    clicked, detail = await find_and_click(page, [
        'tr:nth-child(2)',
        'tr:nth-child(2) td a',
        'tr:nth-child(2) a',
        '[class*="card" i]:first-of-type',
        'a[href*="rfi"]',
        'li:first-child a',
        'table tbody tr:first-child',
    ], "RFI")
    step.success = clicked
    step.detail = detail
    scene.add_step(step)

    if clicked:
        scene.score += 3
        scene.wins.append("Can click into individual RFI")
        step.screenshot_taken = await safe_screenshot(page, "scene3_rfi_detail")
        # Navigate back for next steps
        await safe_navigate(page, "/rfis")
    else:
        scene.blockers.append("Cannot click into individual RFI records")

    # Step 4: Try to create a new RFI
    step = StepResult("click", "Create New RFI button")
    clicked, detail = await find_and_click(page, [
        'button:has-text("Create")',
        'button:has-text("New RFI")',
        'button:has-text("Add RFI")',
        'button:has-text("New")',
        'a:has-text("Create")',
        'a:has-text("New RFI")',
        '[data-testid*="create"]',
        '[class*="create" i]',
        'button[class*="primary" i]',
    ], "Create New RFI")
    step.success = clicked
    step.detail = detail
    scene.add_step(step)

    if clicked:
        scene.score += 2
        scene.wins.append("Create RFI button exists and is clickable")
        step.screenshot_taken = await safe_screenshot(page, "scene3_create_rfi")

        # Step 5: Try to fill in the form
        step = StepResult("fill", "RFI subject field")
        filled, detail = await try_fill_field(page, [
            'input[name="subject"]',
            'input[name="title"]',
            'input[placeholder*="subject" i]',
            'input[placeholder*="title" i]',
            'input[type="text"]:first-of-type',
        ], "Demo rehearsal RFI — foundation pour timing", "subject")
        step.success = filled
        step.detail = detail
        scene.add_step(step)

        if filled:
            scene.score += 2
            scene.wins.append("Can fill in RFI form fields")

            # Try description
            step = StepResult("fill", "RFI description field")
            filled_desc, detail_desc = await try_fill_field(page, [
                'textarea[name="description"]',
                'textarea[name="body"]',
                'textarea',
                '[contenteditable="true"]',
            ], "Need clarification on foundation pour schedule for section B2.", "description")
            step.success = filled_desc
            step.detail = detail_desc
            scene.add_step(step)

            if filled_desc:
                scene.score += 1
                scene.wins.append("Can fill RFI description")

            step.screenshot_taken = await safe_screenshot(page, "scene3_rfi_form_filled")
        else:
            scene.blockers.append("RFI form appeared but fields couldn't be filled")
    else:
        scene.blockers.append("No 'Create New RFI' button found")

    # Step 6: Check for empty state
    step = StepResult("evaluate", "RFI page data quality")
    state = await detect_empty_or_error(page)
    if state.get("is_empty"):
        step.detail = f"RFI page shows empty state: {state.get('empty_matches', [])}"
        step.success = False
        scene.blockers.append("RFI page is empty — no RFI records exist")
    else:
        step.detail = "RFI page has content"
        step.success = True
        scene.score += 2
    scene.add_step(step)

    # Verdict
    if scene.score >= 12:
        scene.verdict = "RFI management works. GC can browse, view, and create RFIs. This is demo-ready."
    elif scene.score >= 8:
        scene.verdict = "RFI page has content and some interaction. Needs polish but shows capability."
    elif scene.score >= 4:
        scene.verdict = "RFI page exists but workflow is incomplete. GC can see something but not complete a task."
    else:
        scene.verdict = "RFI page is empty or broken. A GC would expect this to be a core feature."

    return scene


async def scene_4_submittals(page) -> SceneResult:
    """SCENE 4: Submittals"""
    scene = SceneResult("Submittals", "/submittals", max_score=12)

    # Step 1: Navigate
    step = StepResult("navigate", "/submittals")
    success, status, detail = await safe_navigate(page, "/submittals")
    step.success = success
    step.detail = detail
    step.screenshot_taken = await safe_screenshot(page, "scene4_submittals")
    scene.add_step(step)

    if not success:
        scene.auth_blocked = "/login" in detail or "/auth" in detail
        scene.blockers.append(f"Submittals page failed to load: {detail}")
        scene.verdict = "Submittals page doesn't exist or requires auth."
        return scene

    scene.score += 2

    # Step 2: Look for submittal list with status
    step = StepResult("look_for", "submittal list with status")
    found, detail = await find_text(page, [
        "pending", "approved", "rejected", "submitted", "in review",
        "submittal", "sub-", "SUB-"
    ])
    data = await count_data_elements(page)
    has_data = data.get("table_rows", 0) > 1 or data.get("cards", 0) > 0
    step.found = found and has_data
    step.detail = f"Status text found: {found}. Data: rows={data.get('table_rows', 0)}, cards={data.get('cards', 0)}"
    scene.add_step(step)

    if found and has_data:
        scene.score += 3
        scene.wins.append("Submittal list with status indicators present")
    elif has_data:
        scene.score += 1
        scene.blockers.append("Submittal data exists but status unclear")
    else:
        scene.blockers.append("No submittal data visible")

    # Step 3: Try to click on a submittal
    step = StepResult("click", "individual submittal")
    clicked, detail = await find_and_click(page, [
        'tr:nth-child(2) a',
        'tr:nth-child(2)',
        '[class*="card" i]:first-of-type a',
        'a[href*="submittal"]',
        'table tbody tr:first-child',
    ], "submittal")
    step.success = clicked
    step.detail = detail
    scene.add_step(step)

    if clicked:
        scene.score += 3
        scene.wins.append("Can click into individual submittal")
        step.screenshot_taken = await safe_screenshot(page, "scene4_submittal_detail")
    else:
        scene.blockers.append("Cannot click into individual submittal records")

    # Step 4: Evaluate data quality
    step = StepResult("evaluate", "submittal data quality")
    state = await detect_empty_or_error(page)
    if state.get("is_empty"):
        step.success = False
        step.detail = f"Submittals page is empty: {state.get('empty_matches', [])}"
        scene.blockers.append("Submittals page is empty")
    elif state.get("is_error"):
        step.success = False
        step.detail = f"Error on submittals page: {state.get('error_matches', [])}"
        scene.blockers.append("Error state on submittals page")
    else:
        step.success = True
        step.detail = f"Submittals page has content ({state.get('text_length', 0)} chars)"
        scene.score += 4
        scene.wins.append("Submittals page has real content")
    scene.add_step(step)

    # Verdict
    if scene.score >= 10:
        scene.verdict = "Submittals work well. Real data with status, clickable records."
    elif scene.score >= 6:
        scene.verdict = "Submittals page exists with some data. GC sees something but interaction is limited."
    elif scene.score >= 3:
        scene.verdict = "Submittals page is a shell. Layout exists but no real data."
    else:
        scene.verdict = "Submittals page is broken or empty. Table stakes failure."

    return scene


async def scene_5_budget(page) -> SceneResult:
    """SCENE 5: Financial (Budget)"""
    scene = SceneResult("Financial (Budget)", "/budget", max_score=12)

    # Step 1: Navigate
    step = StepResult("navigate", "/budget")
    success, status, detail = await safe_navigate(page, "/budget")
    step.success = success
    step.detail = detail
    step.screenshot_taken = await safe_screenshot(page, "scene5_budget")
    scene.add_step(step)

    if not success:
        scene.auth_blocked = "/login" in detail or "/auth" in detail
        scene.blockers.append(f"Budget page failed to load: {detail}")
        scene.verdict = "Budget page doesn't exist or requires auth."
        return scene

    scene.score += 2

    # Step 2: Look for financial metrics
    financial_terms = {
        "original budget": ["original budget", "original contract", "budget total"],
        "committed costs": ["committed", "commitment", "committed cost"],
        "projected costs": ["projected", "forecast", "estimated at completion", "eac"],
        "variance": ["variance", "over budget", "under budget", "delta", "change order"],
    }

    metrics_found = 0
    for term_name, patterns in financial_terms.items():
        step = StepResult("look_for", term_name)
        found, detail = await find_text(page, patterns)
        step.found = found
        step.detail = detail
        scene.add_step(step)
        if found:
            metrics_found += 1
            scene.wins.append(f"'{term_name}' found on budget page")

    scene.score += min(4, metrics_found * 1)

    # Step 3: Look for dollar amounts (critical for budget page)
    step = StepResult("look_for", "dollar amounts on budget page")
    data = await count_data_elements(page)
    dollar_count = data.get("dollar_amounts", 0)
    step.found = dollar_count >= 3  # Budget page should have many dollar values
    step.detail = f"Dollar amounts found: {dollar_count}"
    scene.add_step(step)

    if dollar_count >= 5:
        scene.score += 3
        scene.wins.append(f"Budget page shows {dollar_count} dollar amounts — looks like real financial data")
    elif dollar_count >= 1:
        scene.score += 1
        scene.blockers.append(f"Only {dollar_count} dollar amounts — budget feels thin")
    else:
        scene.blockers.append("No dollar amounts on budget page — this is the BUDGET page")

    # Step 4: Check if numbers look realistic for $52M project
    step = StepResult("evaluate", "financial data realism")
    found_52m, _ = await find_text(page, ["52,000,000", "$52M", "$52,0", "52000000", "$52"])
    found_millions, _ = await find_text(page, ["million", ",000,000", "M"])
    step.found = found_52m or found_millions
    if found_52m:
        step.detail = "Found $52M range values — matches Riverside Tower project"
        scene.score += 3
        scene.wins.append("Budget values are in $52M range — realistic for Riverside Tower")
    elif found_millions:
        step.detail = "Found million-dollar values but not specifically $52M"
        scene.score += 1
    else:
        step.detail = "No million-dollar values found — budget may have toy numbers or be empty"
        scene.blockers.append("Budget values don't match a $52M commercial project")
    scene.add_step(step)

    # Verdict
    if scene.score >= 10:
        scene.verdict = "Budget page shows real financial data at the right scale. GC would engage."
    elif scene.score >= 6:
        scene.verdict = "Budget page has some data but incomplete. GC would notice missing metrics."
    elif scene.score >= 3:
        scene.verdict = "Budget page exists but looks empty or has placeholder values."
    else:
        scene.verdict = "Budget page is a disaster. No financial data on the financial page."

    return scene


async def scene_6_daily_log(page) -> SceneResult:
    """SCENE 6: Field Operations (Daily Log)"""
    scene = SceneResult("Field Operations (Daily Log)", "/daily-log", max_score=12)

    # Step 1: Navigate
    step = StepResult("navigate", "/daily-log")
    success, status, detail = await safe_navigate(page, "/daily-log")
    step.success = success
    step.detail = detail
    step.screenshot_taken = await safe_screenshot(page, "scene6_daily_log")
    scene.add_step(step)

    if not success:
        scene.auth_blocked = "/login" in detail or "/auth" in detail
        scene.blockers.append(f"Daily Log page failed to load: {detail}")
        scene.verdict = "Daily Log page doesn't exist or requires auth."
        return scene

    scene.score += 2

    # Step 2: Look for dated entries
    step = StepResult("look_for", "dated log entries")
    found_dates, detail_dates = await find_text(page, [
        "2026", "2025", "monday", "tuesday", "wednesday", "thursday", "friday",
        "january", "february", "march", "april", "today", "yesterday"
    ])
    found_field, detail_field = await find_text(page, [
        "weather", "crew", "work performed", "daily", "log entry",
        "temperature", "conditions", "notes", "hours"
    ])
    step.found = found_dates and found_field
    step.detail = f"Dates: {detail_dates}. Field terms: {detail_field}"
    scene.add_step(step)

    if found_dates and found_field:
        scene.score += 3
        scene.wins.append("Daily log has dated entries with field data")
    elif found_dates or found_field:
        scene.score += 1
        scene.blockers.append("Partial daily log content — missing dates or field data")
    else:
        scene.blockers.append("No dated entries or field data found on daily log page")

    # Step 3: Look for historical entries
    step = StepResult("look_for", "multiple log entries (history)")
    data = await count_data_elements(page)
    entry_count = data.get("table_rows", 0) + data.get("cards", 0) + data.get("list_items", 0)
    step.found = entry_count >= 3
    step.detail = f"Potential entries: {entry_count} (rows: {data.get('table_rows', 0)}, cards: {data.get('cards', 0)}, list items: {data.get('list_items', 0)})"
    scene.add_step(step)

    if entry_count >= 5:
        scene.score += 2
        scene.wins.append(f"Daily log has {entry_count} entries — shows history")
    elif entry_count >= 1:
        scene.score += 1
    else:
        scene.blockers.append("No historical log entries visible")

    # Step 4: Try to create a new daily log entry
    step = StepResult("click", "Create daily log entry button")
    clicked, detail = await find_and_click(page, [
        'button:has-text("Create")',
        'button:has-text("New Log")',
        'button:has-text("Add Entry")',
        'button:has-text("New Entry")',
        'button:has-text("New")',
        'a:has-text("Create")',
        'a:has-text("New Log")',
        '[data-testid*="create"]',
    ], "New Daily Log")
    step.success = clicked
    step.detail = detail
    scene.add_step(step)

    if clicked:
        scene.score += 3
        scene.wins.append("Can create new daily log entry")
        step.screenshot_taken = await safe_screenshot(page, "scene6_create_log")
    else:
        scene.blockers.append("No button to create new daily log entry")

    # Step 5: Evaluate
    step = StepResult("evaluate", "daily log completeness")
    state = await detect_empty_or_error(page)
    if state.get("is_empty"):
        step.success = False
        step.detail = f"Daily log is empty: {state.get('empty_matches', [])}"
        scene.blockers.append("Daily log page is empty")
    else:
        step.success = True
        step.detail = f"Daily log has content ({state.get('text_length', 0)} chars)"
        scene.score += 2
    scene.add_step(step)

    # Verdict
    if scene.score >= 10:
        scene.verdict = "Daily log works. Superintendent can see history and create entries. Field-ready."
    elif scene.score >= 6:
        scene.verdict = "Daily log has some data but creation workflow is incomplete."
    elif scene.score >= 3:
        scene.verdict = "Daily log page exists but feels empty. Superintendent would not trust it."
    else:
        scene.verdict = "Daily log is non-functional. Field operations are a core GC need."

    return scene


async def scene_7_copilot(page) -> SceneResult:
    """SCENE 7: The Wow Moment (AI Copilot)"""
    scene = SceneResult("AI Copilot (Wow Moment)", "/copilot", max_score=15)

    # Step 1: Navigate
    step = StepResult("navigate", "/copilot")
    success, status, detail = await safe_navigate(page, "/copilot")
    step.success = success
    step.detail = detail
    step.screenshot_taken = await safe_screenshot(page, "scene7_copilot")
    scene.add_step(step)

    if not success:
        scene.auth_blocked = "/login" in detail or "/auth" in detail
        scene.blockers.append(f"AI Copilot page failed to load: {detail}")
        scene.verdict = "AI Copilot page doesn't exist or requires auth. The wow moment is missing entirely."
        return scene

    scene.score += 2

    # Step 2: Look for a chat/question input
    step = StepResult("look_for", "chat input or question field")
    chat_selectors = [
        'textarea',
        'input[type="text"]',
        '[contenteditable="true"]',
        'input[placeholder*="ask" i]',
        'input[placeholder*="question" i]',
        'input[placeholder*="type" i]',
        'input[placeholder*="chat" i]',
        'textarea[placeholder*="ask" i]',
    ]

    input_found = False
    for selector in chat_selectors:
        try:
            element = await page.wait_for_selector(selector, timeout=3000)
            if element and await element.is_visible():
                input_found = True
                step.found = True
                step.detail = f"Chat input found via selector: {selector}"
                break
        except Exception:
            continue

    if not input_found:
        step.found = False
        step.detail = "No chat input, textarea, or question field found on copilot page"
        scene.blockers.append("AI Copilot has no input field — cannot ask questions")

    scene.add_step(step)

    if not input_found:
        scene.verdict = "AI Copilot page exists but has no input field. The wow moment is impossible."
        return scene

    scene.score += 3

    # Step 3: Type a question
    step = StepResult("fill", "AI question")
    question = "What RFIs are overdue this week?"
    filled = False
    for selector in chat_selectors:
        try:
            element = await page.wait_for_selector(selector, timeout=2000)
            if element and await element.is_visible():
                await element.fill(question)
                filled = True
                step.success = True
                step.detail = f"Typed: '{question}'"
                break
        except Exception:
            continue

    if not filled:
        step.success = False
        step.detail = "Could not type into the chat input"
        scene.blockers.append("Chat input exists but cannot be typed into")
    scene.add_step(step)

    if not filled:
        scene.verdict = "AI Copilot has an input but it can't be typed into. Broken."
        return scene

    scene.score += 2

    # Step 4: Submit the question
    step = StepResult("click", "submit/send button")
    submitted = False

    # Try pressing Enter first
    try:
        await page.keyboard.press("Enter")
        submitted = True
        step.detail = "Submitted via Enter key"
    except Exception:
        pass

    if not submitted:
        clicked, detail = await find_and_click(page, [
            'button:has-text("Send")',
            'button:has-text("Ask")',
            'button:has-text("Submit")',
            'button[type="submit"]',
            '[class*="send" i]',
            'button:has([class*="arrow"])',
        ], "Send")
        submitted = clicked
        step.detail = detail

    step.success = submitted
    scene.add_step(step)

    if not submitted:
        scene.blockers.append("Cannot submit question to AI Copilot")
        scene.verdict = "AI Copilot has input but no way to submit. Dead end."
        return scene

    scene.score += 2

    # Step 5: Wait for AI response
    step = StepResult("wait", "AI response")
    start_wait = time.time()

    # Wait up to AI_RESPONSE_TIMEOUT for new content to appear
    try:
        # Wait for any response indicator
        response_found = False
        for _ in range(int(AI_RESPONSE_TIMEOUT / 500)):
            await page.wait_for_timeout(500)
            # Look for response content
            text = await page.evaluate("""
                () => document.body.innerText
            """)
            text_lower = text.lower() if text else ""

            # Check for AI response indicators
            has_response = any(indicator in text_lower for indicator in [
                "rfi", "overdue", "week", "no overdue", "found",
                "here are", "the following", "based on", "i found",
                "there are", "sorry", "i don't", "i can't",
            ]) and len(text) > 200

            # Check for typing/loading indicators
            is_thinking = any(indicator in text_lower for indicator in [
                "thinking", "typing", "generating", "..."
            ])

            if has_response and not is_thinking:
                response_found = True
                break

        wait_time = round((time.time() - start_wait) * 1000)
        step.duration_ms = wait_time

        if response_found:
            step.success = True
            step.detail = f"AI responded after {wait_time}ms"
            step.screenshot_taken = await safe_screenshot(page, "scene7_ai_response")
            scene.score += 4
            scene.wins.append("AI Copilot responds to questions — the wow moment works")

            # Step 6: Check if response references actual project data
            step2 = StepResult("evaluate", "AI response quality")
            found_data, data_detail = await find_text(page, [
                "riverside", "tower", "rfi-", "RFI-", "foundation",
                "mechanical", "electrical", "plumbing", "concrete",
                "$", "schedule", "delay"
            ])
            step2.found = found_data
            if found_data:
                step2.detail = f"AI references project-specific data: {data_detail}"
                scene.score += 2
                scene.wins.append("AI response references actual project data")
            else:
                step2.detail = "AI responded but with generic text, not project-specific data"
                scene.blockers.append("AI response is generic — doesn't reference Riverside Tower data")
            scene.add_step(step2)
        else:
            step.success = False
            step.detail = f"No AI response after {wait_time}ms"
            scene.blockers.append(f"AI Copilot non-functional — no response after {wait_time}ms")
            step.screenshot_taken = await safe_screenshot(page, "scene7_no_response")

    except Exception as e:
        step.success = False
        step.detail = f"Error waiting for AI response: {str(e)[:100]}"
        scene.blockers.append("AI Copilot crashed during response")

    scene.add_step(step)

    # Verdict
    if scene.score >= 12:
        scene.verdict = "AI Copilot is the wow moment. GC asks a question, gets a real answer about their project. This is the differentiator."
    elif scene.score >= 8:
        scene.verdict = "AI Copilot responds but answers are generic. Close to the wow moment but needs project data integration."
    elif scene.score >= 4:
        scene.verdict = "AI Copilot page exists with an input but responses are broken or absent."
    else:
        scene.verdict = "AI Copilot is non-functional. The ONE feature that differentiates us from Procore doesn't work."

    return scene


async def scene_8_schedule(page) -> SceneResult:
    """SCENE 8: Schedule"""
    scene = SceneResult("Schedule", "/schedule", max_score=12)

    # Step 1: Navigate
    step = StepResult("navigate", "/schedule")
    success, status, detail = await safe_navigate(page, "/schedule")
    step.success = success
    step.detail = detail
    step.screenshot_taken = await safe_screenshot(page, "scene8_schedule")
    scene.add_step(step)

    if not success:
        scene.auth_blocked = "/login" in detail or "/auth" in detail
        scene.blockers.append(f"Schedule page failed to load: {detail}")
        scene.verdict = "Schedule page doesn't exist or requires auth."
        return scene

    scene.score += 2

    # Step 2: Look for Gantt chart or timeline
    step = StepResult("look_for", "Gantt chart or timeline view")
    found_gantt, _ = await find_text(page, [
        "gantt", "timeline", "milestone", "critical path",
        "duration", "start date", "end date", "task",
    ])

    # Also check for SVG/canvas (Gantt charts are often rendered as SVG)
    has_visual = False
    try:
        has_visual = await page.evaluate("""
            () => {
                const svgs = document.querySelectorAll('svg').length;
                const canvases = document.querySelectorAll('canvas').length;
                const charts = document.querySelectorAll('[class*="chart" i], [class*="gantt" i], [class*="timeline" i]').length;
                return (svgs + canvases + charts) > 0;
            }
        """)
    except Exception:
        pass

    step.found = found_gantt or has_visual
    step.detail = f"Schedule terms found: {found_gantt}. Visual elements (SVG/canvas/chart): {has_visual}"
    scene.add_step(step)

    if found_gantt and has_visual:
        scene.score += 4
        scene.wins.append("Schedule has both timeline content and visual chart elements")
    elif has_visual:
        scene.score += 3
        scene.wins.append("Schedule has visual chart elements")
    elif found_gantt:
        scene.score += 2
        scene.wins.append("Schedule has timeline text content")
        scene.blockers.append("No visual Gantt chart — schedule is text-only")
    else:
        scene.blockers.append("No Gantt chart, timeline, or schedule visualization found")

    # Step 3: Look for task data
    step = StepResult("look_for", "schedule task data")
    data = await count_data_elements(page)
    task_count = data.get("table_rows", 0) + data.get("list_items", 0)
    step.found = task_count > 3
    step.detail = f"Potential tasks: {task_count} (rows: {data.get('table_rows', 0)}, list items: {data.get('list_items', 0)})"
    scene.add_step(step)

    if task_count > 5:
        scene.score += 3
        scene.wins.append(f"Schedule has {task_count} tasks/items")
    elif task_count > 0:
        scene.score += 1
    else:
        scene.blockers.append("No task data visible on schedule page")

    # Step 4: Try to interact (click on a task)
    step = StepResult("click", "schedule task or bar")
    clicked, detail = await find_and_click(page, [
        'svg rect',
        'svg g',
        '[class*="bar" i]',
        '[class*="task" i]',
        'tr:nth-child(2)',
        'li:first-child',
    ], "schedule task")
    step.success = clicked
    step.detail = detail
    scene.add_step(step)

    if clicked:
        scene.score += 3
        scene.wins.append("Schedule tasks are interactive")
        step.screenshot_taken = await safe_screenshot(page, "scene8_schedule_interaction")
    else:
        scene.blockers.append("Schedule is not interactive — cannot click on tasks")

    # Verdict
    if scene.score >= 10:
        scene.verdict = "Schedule view is visual, populated, and interactive. GC can see the project timeline."
    elif scene.score >= 6:
        scene.verdict = "Schedule page has content but is limited. Missing Gantt visualization or interactivity."
    elif scene.score >= 3:
        scene.verdict = "Schedule page exists but is thin. GC would not trust this for schedule management."
    else:
        scene.verdict = "Schedule page is empty or broken. Every GC expects to see a timeline."

    return scene


# ---------------------------------------------------------------------------
# Main Orchestrator
# ---------------------------------------------------------------------------


async def run_rehearsal():
    """Run the complete demo rehearsal."""
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("ERROR: playwright not installed. Run: pip install playwright")
        fallback = {
            "error": "playwright not installed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "scenes": [],
            "overall_score": 0,
            "max_score": 100,
        }
        with open(REHEARSAL_JSON, "w") as f:
            json.dump(fallback, f, indent=2)
        sys.exit(1)

    print("=" * 70)
    print("DEMO REHEARSAL — SiteSync PM")
    print(f"Target: {APP_URL}")
    print(f"Demo Date: {DEMO_DATE}")
    print(f"Rehearsal Time: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 70)

    scenes: list[SceneResult] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="SiteSync-DemoRehearsal/1.0",
        )
        page = await context.new_page()

        # Suppress console noise
        page.on("console", lambda msg: None)

        # --- Scene 1: Portfolio ---
        print("\n--- SCENE 1: First Impression (Portfolio) ---")
        scene1 = await scene_1_portfolio(page)
        scenes.append(scene1)
        print(f"  Score: {scene1.score}/{scene1.max_score}")
        print(f"  Verdict: {scene1.verdict}")

        # --- Scene 2: Dashboard ---
        print("\n--- SCENE 2: Project Overview (Dashboard) ---")
        scene2 = await scene_2_dashboard(page)
        scenes.append(scene2)
        print(f"  Score: {scene2.score}/{scene2.max_score}")
        print(f"  Verdict: {scene2.verdict}")

        # --- Scene 3: RFIs ---
        print("\n--- SCENE 3: Document Management (RFIs) ---")
        scene3 = await scene_3_rfis(page)
        scenes.append(scene3)
        print(f"  Score: {scene3.score}/{scene3.max_score}")
        print(f"  Verdict: {scene3.verdict}")

        # --- Scene 4: Submittals ---
        print("\n--- SCENE 4: Submittals ---")
        scene4 = await scene_4_submittals(page)
        scenes.append(scene4)
        print(f"  Score: {scene4.score}/{scene4.max_score}")
        print(f"  Verdict: {scene4.verdict}")

        # --- Scene 5: Budget ---
        print("\n--- SCENE 5: Financial (Budget) ---")
        scene5 = await scene_5_budget(page)
        scenes.append(scene5)
        print(f"  Score: {scene5.score}/{scene5.max_score}")
        print(f"  Verdict: {scene5.verdict}")

        # --- Scene 6: Daily Log ---
        print("\n--- SCENE 6: Field Operations (Daily Log) ---")
        scene6 = await scene_6_daily_log(page)
        scenes.append(scene6)
        print(f"  Score: {scene6.score}/{scene6.max_score}")
        print(f"  Verdict: {scene6.verdict}")

        # --- Scene 7: AI Copilot ---
        print("\n--- SCENE 7: AI Copilot (The Wow Moment) ---")
        scene7 = await scene_7_copilot(page)
        scenes.append(scene7)
        print(f"  Score: {scene7.score}/{scene7.max_score}")
        print(f"  Verdict: {scene7.verdict}")

        # --- Scene 8: Schedule ---
        print("\n--- SCENE 8: Schedule ---")
        scene8 = await scene_8_schedule(page)
        scenes.append(scene8)
        print(f"  Score: {scene8.score}/{scene8.max_score}")
        print(f"  Verdict: {scene8.verdict}")

        await browser.close()

    return scenes


def compute_overall_score(scenes: list[SceneResult]) -> int:
    """
    Compute overall demo readiness score (0-100).
    
    Weighted by demo importance:
    - Dashboard and AI Copilot are weighted higher (the first impression and wow moment)
    - Core features (RFIs, Submittals, Budget) are medium weight
    - Supporting features (Daily Log, Schedule, Portfolio) are standard weight
    """
    total_earned = sum(s.score for s in scenes)
    total_possible = sum(s.max_score for s in scenes)

    if total_possible == 0:
        return 0

    raw_pct = (total_earned / total_possible) * 100

    # Apply auth penalty: if more than 2 scenes are auth-blocked, severe penalty
    auth_blocked_count = sum(1 for s in scenes if s.auth_blocked)
    if auth_blocked_count >= 4:
        raw_pct = min(raw_pct, 15)  # Cap at 15 if most pages need auth
    elif auth_blocked_count >= 2:
        raw_pct = min(raw_pct, 35)  # Cap at 35 if several pages need auth

    return round(raw_pct)


def generate_summary_md(scenes: list[SceneResult], overall_score: int) -> str:
    """Generate the human-readable demo rehearsal summary."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    lines = []
    lines.append(f"# Demo Rehearsal Report — {now}")
    lines.append("")
    lines.append(f"**App URL:** {APP_URL}")
    lines.append(f"**Demo Date:** {DEMO_DATE}")
    lines.append("")

    # Overall Score
    lines.append(f"## Overall Score: {overall_score}/100")
    lines.append("")

    if overall_score >= 80:
        lines.append("> Demo is in good shape. Focus on polish and the wow moment.")
    elif overall_score >= 60:
        lines.append("> Demo is functional but has gaps. A GC would see potential but also rough edges.")
    elif overall_score >= 40:
        lines.append("> Demo is NOT ready. Multiple core features are broken or empty. This needs urgent work.")
    elif overall_score >= 20:
        lines.append("> Demo is in critical condition. Most pages are broken, empty, or inaccessible.")
    else:
        lines.append("> **EMERGENCY.** A GC seeing this today would close the tab in 30 seconds. The product appears non-functional.")
    lines.append("")

    # Score breakdown table
    lines.append("## Score Breakdown")
    lines.append("")
    lines.append("| Scene | Path | Score | Status |")
    lines.append("|-------|------|-------|--------|")
    for s in scenes:
        pct = round((s.score / s.max_score) * 100) if s.max_score > 0 else 0
        if s.auth_blocked:
            status = "AUTH BLOCKED"
        elif pct >= 80:
            status = "READY"
        elif pct >= 50:
            status = "PARTIAL"
        elif pct > 0:
            status = "WEAK"
        else:
            status = "BROKEN"
        lines.append(f"| {s.scene} | `{s.path}` | {s.score}/{s.max_score} ({pct}%) | {status} |")
    lines.append("")

    # Critical Blockers
    all_blockers = []
    for s in scenes:
        for b in s.blockers:
            all_blockers.append(f"[{s.scene}] {b}")

    lines.append("## Critical Blockers (fix these first)")
    lines.append("")
    if not all_blockers:
        lines.append("*No blockers found — all scenes passed.*")
    else:
        # Prioritize: auth blockers first, then copilot/dashboard, then others
        auth_blockers = [b for b in all_blockers if "auth" in b.lower()]
        copilot_blockers = [b for b in all_blockers if "copilot" in b.lower() or "ai" in b.lower()]
        dashboard_blockers = [b for b in all_blockers if "dashboard" in b.lower()]
        other_blockers = [b for b in all_blockers if b not in auth_blockers + copilot_blockers + dashboard_blockers]

        idx = 1
        for b in auth_blockers:
            lines.append(f"{idx}. **[AUTH]** {b}")
            idx += 1
        for b in copilot_blockers:
            lines.append(f"{idx}. **[WOW MOMENT]** {b}")
            idx += 1
        for b in dashboard_blockers:
            lines.append(f"{idx}. **[FIRST IMPRESSION]** {b}")
            idx += 1
        for b in other_blockers:
            lines.append(f"{idx}. {b}")
            idx += 1
    lines.append("")

    # Scenes That Work
    working_scenes = [s for s in scenes if (s.score / s.max_score) >= 0.6 and not s.auth_blocked]
    lines.append("## Scenes That Work")
    lines.append("")
    if working_scenes:
        for s in working_scenes:
            wins_str = "; ".join(s.wins[:3]) if s.wins else "basic functionality"
            lines.append(f"- **{s.scene}** ({s.score}/{s.max_score}): {wins_str}")
    else:
        lines.append("*No scenes scored above 60%. Nothing is demo-ready.*")
    lines.append("")

    # Scenes That Fail
    failing_scenes = [s for s in scenes if (s.score / s.max_score) < 0.4 or s.auth_blocked]
    lines.append("## Scenes That Fail")
    lines.append("")
    if failing_scenes:
        for s in failing_scenes:
            lines.append(f"- **{s.scene}** ({s.score}/{s.max_score}): {s.verdict}")
    else:
        lines.append("*All scenes scored above 40%. No outright failures.*")
    lines.append("")

    # The GC's Experience (narrative)
    lines.append("## The GC's Experience (narrative)")
    lines.append("")
    lines.append("*This is what a General Contractor would experience during a 10-minute evaluation of SiteSync PM on demo day:*")
    lines.append("")

    for s in scenes:
        lines.append(f"### {s.scene}")
        lines.append("")
        lines.append(f"**{s.verdict}**")
        lines.append("")
        if s.wins:
            lines.append(f"What works: {'; '.join(s.wins)}")
        if s.blockers:
            lines.append(f"What breaks: {'; '.join(s.blockers)}")
        lines.append("")

    # The Bottom Line
    lines.append("## The Bottom Line")
    lines.append("")

    if overall_score >= 80:
        lines.append("The demo is ready. A GC would see a real product with real data. Polish the edges, rehearse the narrative, and ship it.")
    elif overall_score >= 60:
        lines.append("The demo is close but not there. A GC would see potential but also stumble on broken workflows. Fix the blockers above and the score jumps to 80+.")
    elif overall_score >= 40:
        lines.append(f"A GC seeing this today would think 'they're not ready.' {len(all_blockers)} blockers need to be fixed. Focus exclusively on what the GC sees in the demo flow — nothing else matters.")
    elif overall_score >= 20:
        lines.append(f"A GC seeing this today would close the tab in under a minute. {len(all_blockers)} blockers, most pages empty or broken. This is a code-red situation. Cancel all non-demo work.")
    else:
        lines.append(f"A GC seeing this today would close the tab in 30 seconds because the product appears non-functional. {len(all_blockers)} blockers across {len(failing_scenes)} failing scenes. The entire system needs to focus on making the demo flow work end-to-end. Nothing else matters.")
    lines.append("")

    # For the strategic reasoning agent
    lines.append("---")
    lines.append("")
    lines.append("## Priority Matrix for Tonight's Build")
    lines.append("")
    lines.append("Based on this rehearsal, here is the priority order:")
    lines.append("")

    priorities = []
    # Auth is always #1 if it's blocking
    if any(s.auth_blocked for s in scenes):
        priorities.append("**P0 — Auth:** Make demo pages accessible without auth (or provide demo credentials)")
    # Then the worst-scoring critical scenes
    critical_scenes = sorted(
        [s for s in scenes if not s.auth_blocked],
        key=lambda s: s.score / max(s.max_score, 1)
    )
    for s in critical_scenes[:3]:
        pct = round((s.score / s.max_score) * 100)
        if pct < 50:
            priorities.append(f"**P1 — {s.scene}** ({pct}%): {s.blockers[0] if s.blockers else s.verdict}")
    for s in critical_scenes[3:]:
        pct = round((s.score / s.max_score) * 100)
        if pct < 70:
            priorities.append(f"**P2 — {s.scene}** ({pct}%): {s.blockers[0] if s.blockers else 'Needs polish'}")

    for i, p in enumerate(priorities, 1):
        lines.append(f"{i}. {p}")

    if not priorities:
        lines.append("All scenes are in reasonable shape. Focus on polish and the wow moment.")

    lines.append("")

    return "\n".join(lines)


async def main():
    """Run the complete demo rehearsal and write outputs."""
    scenes = await run_rehearsal()

    overall_score = compute_overall_score(scenes)

    # Write JSON output
    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "app_url": APP_URL,
        "demo_date": DEMO_DATE,
        "overall_score": overall_score,
        "max_score": 100,
        "scenes": [s.to_dict() for s in scenes],
        "total_blockers": sum(len(s.blockers) for s in scenes),
        "total_wins": sum(len(s.wins) for s in scenes),
        "auth_blocked_scenes": sum(1 for s in scenes if s.auth_blocked),
    }

    with open(REHEARSAL_JSON, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nJSON results written to {REHEARSAL_JSON}")

    # Write summary markdown
    summary = generate_summary_md(scenes, overall_score)
    with open(REHEARSAL_MD, "w") as f:
        f.write(summary)
    print(f"Summary written to {REHEARSAL_MD}")

    # Final output
    print("\n" + "=" * 70)
    print(f"DEMO READINESS SCORE: {overall_score}/100")
    print("=" * 70)

    for s in scenes:
        status = "AUTH" if s.auth_blocked else ("OK" if s.score / s.max_score >= 0.6 else "FAIL")
        print(f"  [{status:4s}] {s.scene:35s} {s.score:2d}/{s.max_score}")

    blocker_count = sum(len(s.blockers) for s in scenes)
    win_count = sum(len(s.wins) for s in scenes)
    print(f"\nBlockers: {blocker_count}  |  Wins: {win_count}")

    if overall_score < 40:
        print("\n*** CRITICAL: Demo is not ready. See .perception/demo-rehearsal-summary.md ***")


if __name__ == "__main__":
    asyncio.run(main())
