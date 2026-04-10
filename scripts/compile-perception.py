#!/usr/bin/env python3
"""Compile all perception artifacts into a single briefing for the Strategic Intelligence.

Reads .perception/*.json, .perception/*.md, .agent/*.json, VISION_CORE.md, TONIGHT.md,
and DAILY_REPORT.md. Outputs .perception/compiled-briefing.md.

Handles missing, empty, and malformed files gracefully — the briefing is always generated.
"""

import json
import os

PERCEPTION_FILES = {
    'Product State': '.perception/app-state.json',
    'Codebase State': '.perception/codebase-state.json',
    'Competitive Landscape': '.perception/competitive-state.json',
    'Urgency Level': '.perception/urgency.json',
    'Demo Rehearsal': '.perception/demo-rehearsal-summary.md',
    'Curiosity Findings': '.agent/curiosity-findings.json',
    'World Model': '.agent/world-model.json',
    'System Health': '.perception/system-health.json'
}

CONTEXT_FILES = {
    'Vision Core': ('VISION_CORE.md', 4000),
    'Previous Strategic Direction': ('TONIGHT.md', 3000),
    'Daily Report': ('DAILY_REPORT.md', 2000),
}


def read_safe(path):
    """Read a file safely. Returns (content, kind) or (None, 'missing')."""
    try:
        if not os.path.exists(path) or os.path.getsize(path) == 0:
            return None, 'missing'
        if path.endswith('.json'):
            with open(path) as f:
                return json.load(f), 'json'
        with open(path) as f:
            return f.read(), 'text'
    except json.JSONDecodeError:
        # JSON file exists but is malformed — read as text instead
        try:
            with open(path) as f:
                return f.read(), 'text'
        except Exception:
            return None, 'error'
    except Exception as e:
        return {'error': str(e)}, 'error'


def main():
    briefing_parts = []

    # Perception artifacts
    for label, path in PERCEPTION_FILES.items():
        data, kind = read_safe(path)
        if data is None:
            briefing_parts.append(f'## {label}\n*Not available — perception artifact missing or empty.*')
        elif kind == 'json':
            truncated = json.dumps(data, indent=2)[:8000]
            briefing_parts.append(f'## {label}\n```json\n{truncated}\n```')
        elif kind == 'error':
            briefing_parts.append(f'## {label}\n```json\n{json.dumps(data, indent=2)}\n```')
        else:
            briefing_parts.append(f'## {label}\n```\n{str(data)[:8000]}\n```')

    # Context files (vision, previous direction, reports)
    for label, (path, max_chars) in CONTEXT_FILES.items():
        data, kind = read_safe(path)
        if data is not None and kind == 'text':
            briefing_parts.append(f'## {label} (excerpt)\n{str(data)[:max_chars]}')
        elif data is not None and kind == 'json':
            briefing_parts.append(f'## {label}\n```json\n{json.dumps(data, indent=2)[:max_chars]}\n```')

    # Assemble
    briefing = '\n\n'.join(briefing_parts)

    os.makedirs('.perception', exist_ok=True)
    with open('.perception/compiled-briefing.md', 'w') as f:
        f.write(briefing)

    print(f'Compiled briefing: {len(briefing)} chars from {len(briefing_parts)} sources')
    print(f'Saved to .perception/compiled-briefing.md')


if __name__ == '__main__':
    main()
