/**
 * PIB — Scoring Engine
 *
 * Calculates precision, recall, and F1 score per category and overall.
 * Reads raw case results and produces the final BenchmarkResult.
 */

import type {
  BenchmarkResult,
  CaseResult,
  CategoryScore,
  Category,
} from "../runners/runner-interface.js";

// ── Metrics ───────────────────────────────────────────────────────────────────

export function precision(tp: number, fp: number): number {
  if (tp + fp === 0) return 0;
  return tp / (tp + fp);
}

export function recall(tp: number, fn: number): number {
  if (tp + fn === 0) return 0;
  return tp / (tp + fn);
}

export function f1(p: number, r: number): number {
  if (p + r === 0) return 0;
  return (2 * p * r) / (p + r);
}

// ── Category Scoring ──────────────────────────────────────────────────────────

export function scoreCases(cases: CaseResult[]): CategoryScore {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (const c of cases) {
    if (c.expected && c.actual) tp++;
    else if (!c.expected && c.actual) fp++;
    else if (!c.expected && !c.actual) tn++;
    else if (c.expected && !c.actual) fn++;
  }

  const p = precision(tp, fp);
  const r = recall(tp, fn);

  return {
    precision: round(p),
    recall: round(r),
    f1: round(f1(p, r)),
    true_positives: tp,
    false_positives: fp,
    true_negatives: tn,
    false_negatives: fn,
    total: cases.length,
  };
}

// ── Full Benchmark Scoring ────────────────────────────────────────────────────

export function computeBenchmarkResult(
  scannerName: string,
  scannerVersion: string,
  benchmarkVersion: string,
  details: CaseResult[],
): BenchmarkResult {
  // Group by category
  const byCategory = new Map<string, CaseResult[]>();
  for (const d of details) {
    const key = d.category;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(d);
  }

  const categories: Record<string, CategoryScore> = {};
  for (const [cat, cases] of byCategory) {
    categories[cat] = scoreCases(cases);
  }

  // Overall counts
  const overall = scoreCases(details);

  return {
    scanner: scannerName,
    scanner_version: scannerVersion,
    benchmark_version: benchmarkVersion,
    timestamp: new Date().toISOString(),
    overall: {
      precision: overall.precision,
      recall: overall.recall,
      f1: overall.f1,
    },
    categories,
    total_cases: details.length,
    true_positives: overall.true_positives,
    false_positives: overall.false_positives,
    true_negatives: overall.true_negatives,
    false_negatives: overall.false_negatives,
    details,
  };
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatResultTable(result: BenchmarkResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(`  PIB ${result.benchmark_version} Results — ${result.scanner} v${result.scanner_version}`);
  lines.push(`  ${"─".repeat(60)}`);
  lines.push("");
  lines.push(
    `  ${"Category".padEnd(25)} ${"Prec".padStart(7)} ${"Recall".padStart(7)} ${"F1".padStart(7)} ${"Cases".padStart(7)}`,
  );
  lines.push(`  ${"─".repeat(60)}`);

  const sortedCats = Object.entries(result.categories).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [cat, score] of sortedCats) {
    lines.push(
      `  ${cat.padEnd(25)} ${pct(score.precision).padStart(7)} ${pct(score.recall).padStart(7)} ${pct(score.f1).padStart(7)} ${String(score.total).padStart(7)}`,
    );
  }

  lines.push(`  ${"─".repeat(60)}`);
  lines.push(
    `  ${"OVERALL".padEnd(25)} ${pct(result.overall.precision).padStart(7)} ${pct(result.overall.recall).padStart(7)} ${pct(result.overall.f1).padStart(7)} ${String(result.total_cases).padStart(7)}`,
  );
  lines.push("");
  lines.push(`  TP: ${result.true_positives}  FP: ${result.false_positives}  TN: ${result.true_negatives}  FN: ${result.false_negatives}`);
  lines.push("");

  return lines.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function round(n: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}
