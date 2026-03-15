/**
 * PIB -- Benchmark Runner
 *
 * Loads all test cases for a benchmark version, runs them through
 * the provided ScannerAdapter, and produces a BenchmarkResult.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  BenchmarkResult,
  CaseResult,
  Category,
  ScannerAdapter,
  TestCase,
} from "./runner-interface.js";
import { computeBenchmarkResult } from "../scoring/score.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const BENCHMARK_ROOT = join(__dirname, "..", "benchmark");

// ── Load Test Cases ───────────────────────────────────────────────────────────

export async function loadTestCases(version: string): Promise<TestCase[]> {
  const versionDir = join(BENCHMARK_ROOT, version);
  const categories = await readdir(versionDir, { withFileTypes: true });
  const cases: TestCase[] = [];

  for (const cat of categories) {
    if (!cat.isDirectory()) continue;
    const catDir = join(versionDir, cat.name);
    const files = await readdir(catDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const raw = await readFile(join(catDir, file), "utf-8");
      const parsed = JSON.parse(raw) as TestCase | TestCase[];

      if (Array.isArray(parsed)) {
        cases.push(...parsed);
      } else {
        cases.push(parsed);
      }
    }
  }

  return cases;
}

// ── Run Benchmark ─────────────────────────────────────────────────────────────

export interface RunOptions {
  /** Run cases in parallel with this concurrency limit. Default: 1 (serial). */
  concurrency?: number;
  /** Progress callback, called after each case completes. */
  onProgress?: (completed: number, total: number, caseId: string) => void;
}

export async function runBenchmark(
  scanner: ScannerAdapter,
  version: string = "v1",
  options: RunOptions = {},
): Promise<BenchmarkResult> {
  const cases = await loadTestCases(version);
  const concurrency = options.concurrency ?? 1;
  const details: CaseResult[] = [];
  let completed = 0;

  if (concurrency <= 1) {
    // Serial execution
    for (const tc of cases) {
      const result = await runSingleCase(scanner, tc);
      details.push(result);
      completed++;
      options.onProgress?.(completed, cases.length, tc.id);
    }
  } else {
    // Parallel execution with concurrency limit
    const queue = [...cases];
    const running: Promise<void>[] = [];

    while (queue.length > 0 || running.length > 0) {
      while (running.length < concurrency && queue.length > 0) {
        const tc = queue.shift()!;
        const promise = runSingleCase(scanner, tc).then((result) => {
          details.push(result);
          completed++;
          options.onProgress?.(completed, cases.length, tc.id);
        });
        running.push(promise);
      }

      if (running.length > 0) {
        await Promise.race(running);
        // Remove settled promises
        for (let i = running.length - 1; i >= 0; i--) {
          const settled = await Promise.race([
            running[i].then(() => true),
            Promise.resolve(false),
          ]);
          if (settled) running.splice(i, 1);
        }
      }
    }
  }

  return computeBenchmarkResult(scanner.name, scanner.version, version, details);
}

async function runSingleCase(
  scanner: ScannerAdapter,
  tc: TestCase,
): Promise<CaseResult> {
  try {
    const result = await scanner.scan(tc.input);
    return {
      id: tc.id,
      category: tc.category,
      expected: tc.expected_detection,
      actual: result.detected,
      correct: result.detected === tc.expected_detection,
      confidence: result.confidence,
    };
  } catch {
    // Scanner error = not detected (fail-open for benchmarking purposes)
    return {
      id: tc.id,
      category: tc.category,
      expected: tc.expected_detection,
      actual: false,
      correct: !tc.expected_detection,
    };
  }
}
