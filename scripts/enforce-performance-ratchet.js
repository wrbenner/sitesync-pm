#!/usr/bin/env node
// enforce-performance-ratchet.js
// The quality ratchet: no metric can ever get worse.
// If it gets better, the floor is updated for future enforcement.
//
// Usage: node scripts/enforce-performance-ratchet.js <perf-results.json> <quality-floor.json>

const fs = require('fs');

const perfResultsPath = process.argv[2];
const floorPath = process.argv[3];

if (!perfResultsPath || !floorPath) {
  console.error('Usage: node enforce-performance-ratchet.js <perf-results.json> <quality-floor.json>');
  process.exit(1);
}

let perfResults;
let floor;

try {
  perfResults = JSON.parse(fs.readFileSync(perfResultsPath, 'utf-8'));
} catch (e) {
  console.error(`Failed to read performance results: ${e.message}`);
  process.exit(1);
}

try {
  floor = JSON.parse(fs.readFileSync(floorPath, 'utf-8'));
} catch (e) {
  console.error(`Failed to read quality floor: ${e.message}`);
  process.exit(1);
}

// Extract the longest response time from test results
// Supports Playwright JSON reporter format and generic { tests: [{ duration }] } format
let currentMax = 0;

if (perfResults.suites) {
  // Playwright format
  const extractDurations = (suite) => {
    const durations = [];
    if (suite.specs) {
      for (const spec of suite.specs) {
        for (const test of spec.tests || []) {
          for (const result of test.results || []) {
            durations.push(result.duration || 0);
          }
        }
      }
    }
    if (suite.suites) {
      for (const sub of suite.suites) {
        durations.push(...extractDurations(sub));
      }
    }
    return durations;
  };
  const allDurations = perfResults.suites.flatMap(extractDurations);
  currentMax = Math.max(0, ...allDurations);
} else if (perfResults.tests) {
  // Generic format
  currentMax = Math.max(0, ...perfResults.tests.map(t => t.duration || 0));
} else if (perfResults.testResults) {
  // Jest/Vitest JSON reporter format
  currentMax = Math.max(0, ...perfResults.testResults.map(t => t.perfStats?.runtime || t.duration || 0));
} else if (perfResults.files) {
  // Vitest bench JSON format: { files: [{ groups: [{ benchmarks: [{ mean }] }] }] }
  const durations = [];
  for (const file of perfResults.files) {
    for (const group of file.groups || []) {
      for (const bench of group.benchmarks || []) {
        // mean is in seconds in vitest bench, convert to ms
        if (bench.mean) durations.push(bench.mean * 1000);
        if (bench.p99) durations.push(bench.p99 * 1000);
      }
    }
  }
  currentMax = Math.max(0, ...durations);
} else if (Array.isArray(perfResults)) {
  // Plain array of { name, duration } objects
  currentMax = Math.max(0, ...perfResults.map(t => t.duration || t.mean || 0));
}

console.log(`Current longest response: ${currentMax}ms`);
console.log(`Floor: ${floor.longestResponseMs}ms`);

if (currentMax > floor.longestResponseMs) {
  console.error(`\nHOMEOSTASIS FAILURE: Response time ${currentMax}ms exceeds floor ${floor.longestResponseMs}ms`);
  console.error('Action: Run `npx ts-node scripts/evolve.ts` to find the regression source');
  process.exit(1);
}

// Ratchet: if we improved, update the floor
if (currentMax > 0 && currentMax < floor.longestResponseMs) {
  const previousFloor = floor.longestResponseMs;
  floor.longestResponseMs = currentMax;
  floor.lastUpdated = new Date().toISOString();
  floor.updatedBy = 'enforce-performance-ratchet.js';
  fs.writeFileSync(floorPath, JSON.stringify(floor, null, 2) + '\n');
  console.log(`\nPerformance improved: ${previousFloor}ms -> ${currentMax}ms (floor updated)`);
} else {
  console.log('\nPerformance within bounds.');
}

console.log('Homeostasis maintained.');
