/**
 * PIB -- Prompt Injection Benchmark
 *
 * Public API for programmatic usage.
 */

export type {
  TestCase,
  ScannerAdapter,
  ScanResult,
  BenchmarkResult,
  CategoryScore,
  CaseResult,
  Category,
  Severity,
} from "./runners/runner-interface.js";

export { runBenchmark, loadTestCases } from "./runners/run-benchmark.js";
export {
  computeBenchmarkResult,
  formatResultTable,
  scoreCases,
  precision,
  recall,
  f1,
} from "./scoring/score.js";
