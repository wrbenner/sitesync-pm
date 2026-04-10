# Reference Library — Taste, Standards, and Competitive Context

This directory gives the autopoietic system a sense of **taste** — an understanding
of what world-class construction software looks and feels like, and what the
competitive landscape demands.

## Why This Exists

An autonomous system building a product needs more than functional requirements.
It needs aesthetic judgment. Without taste, the system will build pages that
"work" but feel like government forms. With taste, it builds pages that feel
like they belong in a portfolio.

The files in this directory are loaded into the strategic reasoning and
reflection workflows so every decision is filtered through:

1. **What does great look like?** (taste-evaluation-prompt.md)
2. **What does the competition look like?** (competitors.md)

## Files

### taste-evaluation-prompt.md

A structured prompt for evaluating the organism's UI work against world-class
standards. Designed to be included in the reflect-and-evolve workflow's Opus
prompt so the Evolution Engine can assess whether tonight's UI changes moved
the product toward "someone would screenshot this" or toward "looks like a
government form."

### competitors.md

Concise competitive intelligence on the construction software market. What
each competitor does well, what they do poorly, and — critically — what they
ALL get wrong. This gets loaded into the strategic reasoning context so the
system knows what it's building against and where the opportunity lies.

## Integration

These files should be loaded into the autopoietic system's context at two points:

1. **perceive-and-reason.yml** — Include `competitors.md` in the compiled
   briefing so the Strategic Mind has competitive context when writing TONIGHT.md.

2. **reflect-and-evolve.yml** — Include `taste-evaluation-prompt.md` in the
   Evolution Engine's prompt so it can evaluate UI quality against real standards.

To add them to the compiled briefing, add to the "Compile Perception Briefing" step:

```python
          # Include taste reference for quality judgment
          if os.path.exists('autopoietic/references/taste-evaluation-prompt.md'):
              with open('autopoietic/references/taste-evaluation-prompt.md') as f:
                  taste = f.read()[:4000]
              briefing_parts.append(f'## Taste Reference\n{taste}')

          if os.path.exists('autopoietic/references/competitors.md'):
              with open('autopoietic/references/competitors.md') as f:
                  competitors = f.read()[:3000]
              briefing_parts.append(f'## Competitive Intelligence\n{competitors}')
```
