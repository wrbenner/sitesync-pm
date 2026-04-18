#!/usr/bin/env npx ts-node
/**
 * scripts/generate-property-tests.ts — Property Test Generator
 *
 * Reads SPEC.md formal properties and generates fast-check property tests.
 * Part of the Immune System (Tier 1: Property-Based Testing).
 *
 * Usage:
 *   npx ts-node scripts/generate-property-tests.ts              # Generate for all genes
 *   npx ts-node scripts/generate-property-tests.ts --gene Budget # Generate for one gene
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface FormalProperty {
  id: string;
  gene: string;
  description: string;
}

/**
 * Parse SPEC.md for formal properties (PROP-XXX entries).
 */
function parseFormalProperties(geneFilter?: string): FormalProperty[] {
  const spec = readFileSync('SPEC.md', 'utf-8');
  const properties: FormalProperty[] = [];

  let currentGene = '';
  const lines = spec.split('\n');

  for (const line of lines) {
    const geneMatch = line.match(/### Gene: (.+)/);
    if (geneMatch) {
      currentGene = geneMatch[1];
    }

    const propMatch = line.match(/^\s+- (PROP-\d+): (.+)/);
    if (propMatch && currentGene) {
      if (!geneFilter || currentGene.toLowerCase().includes(geneFilter.toLowerCase())) {
        properties.push({
          id: propMatch[1],
          gene: currentGene,
          description: propMatch[2],
        });
      }
    }
  }

  return properties;
}

/**
 * Generate a property test file template for a set of properties.
 */
function generatePropertyTestFile(gene: string, properties: FormalProperty[]): string {
  const slug = gene.toLowerCase().replace(/[\s/]+/g, '-');

  const testCases = properties.map(prop => {
    return `  test('${prop.id}: ${prop.description}', () => {
    // TODO: Implement property test for: ${prop.description}
    // Use fc.assert with appropriate arbitraries
    //
    // Example pattern:
    // fc.assert(fc.property(
    //   fc.record({ /* input shape */ }),
    //   (input) => {
    //     const result = functionUnderTest(input);
    //     return /* invariant check */;
    //   }
    // ), { numRuns: 1000 });

    // Placeholder: passes until implemented
    expect(true).toBe(true);
  });`;
  }).join('\n\n');

  return `/**
 * Property Tests: ${gene}
 * Generated from SPEC.md formal properties
 * Run: FAST_CHECK_NUM_RUNS=1000 npx vitest run ${slug}.property.test.ts
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';

describe('${gene} — Formal Properties', () => {
${testCases}
});
`;
}

/**
 * Write property test files to the appropriate directories.
 */
function writePropertyTests(geneFilter?: string): void {
  const properties = parseFormalProperties(geneFilter);

  if (properties.length === 0) {
    console.log('No formal properties found in SPEC.md' + (geneFilter ? ` for gene "${geneFilter}"` : ''));
    return;
  }

  // Group by gene
  const byGene = new Map<string, FormalProperty[]>();
  for (const prop of properties) {
    if (!byGene.has(prop.gene)) byGene.set(prop.gene, []);
    byGene.get(prop.gene)!.push(prop);
  }

  console.log(`Found ${properties.length} formal properties across ${byGene.size} genes:\n`);

  for (const [gene, props] of byGene) {
    const slug = gene.toLowerCase().replace(/[\s/]+/g, '-');
    const testDir = join('src', '__tests__', 'properties');
    const testFile = join(testDir, `${slug}.property.test.ts`);

    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    const content = generatePropertyTestFile(gene, props);
    writeFileSync(testFile, content);

    console.log(`  ${gene}: ${props.length} properties -> ${testFile}`);
    props.forEach(p => console.log(`    ${p.id}: ${p.description}`));
  }

  console.log(`\nGenerated property test files. Run: npx vitest run src/__tests__/properties/`);
}

// ─── CLI ───

const args = process.argv.slice(2);
const geneIdx = args.indexOf('--gene');
const geneFilter = geneIdx !== -1 ? args[geneIdx + 1] : undefined;

writePropertyTests(geneFilter);

export { parseFormalProperties, generatePropertyTestFile };
