/**
 * PIB -- Validate test cases
 *
 * Standalone validation script for CI.
 */

import { loadTestCases } from "./runners/run-benchmark.js";

async function main(): Promise<void> {
  const version = process.argv[2] ?? "v1";
  console.log(`Validating PIB ${version}...`);

  const cases = await loadTestCases(version);
  const ids = new Set<string>();
  let errors = 0;

  for (const tc of cases) {
    if (ids.has(tc.id)) {
      console.error(`DUPLICATE ID: ${tc.id}`);
      errors++;
    }
    ids.add(tc.id);

    if (!tc.id || !tc.category || !tc.input || tc.expected_detection === undefined) {
      console.error(`MISSING FIELDS: ${tc.id}`);
      errors++;
    }
  }

  console.log(`${cases.length} cases checked, ${errors} errors.`);
  if (errors > 0) process.exit(1);
}

main().catch(console.error);
