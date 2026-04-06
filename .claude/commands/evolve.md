EVOLUTION MODE — Optimize existing code, don't add features.

1. Run `npm run build:analyze` and identify the 3 largest code paths
2. For each target function/module:

   a. SEED: Generate 3 different implementations using different algorithmic approaches
   b. SCORE each on:
      - Speed: benchmark with `performance.now()` over 1000 iterations
      - Correctness: all existing tests must pass
      - Bundle impact: measure gzipped size contribution
      - Readability: count cyclomatic complexity (lower = better)
   c. SELECT: keep the best 2
   d. MUTATE: ask for optimized variants of the winners
   e. CROSSOVER: combine best traits from both
   f. REPEAT for 3 generations

3. If the final winner beats the current implementation on ALL metrics:
   - Replace the implementation
   - Record the evolution in LEARNINGS.md:
     "Evolved [function] from [old metrics] to [new metrics] using [approach]"
   - Update .quality-floor.json if bundle size or performance improved

4. If no candidate beats the current on ALL metrics, keep the current.
   Record: "Attempted evolution of [function], current implementation is already optimal for the multi-objective space"

NEVER sacrifice correctness for speed. Correctness weight = 0.4, Speed weight = 0.4, Bundle = 0.1, Readability = 0.1.
