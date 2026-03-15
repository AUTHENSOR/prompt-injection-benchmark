/**
 * PIB -- Runner Interface
 *
 * Implement this interface to benchmark any AI safety scanner against PIB.
 * The interface is deliberately minimal: your scanner takes a string and
 * returns whether it detected something harmful.
 */

// ── Test Case Schema ──────────────────────────────────────────────────────────

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Category =
  | "prompt-injection"
  | "jailbreak"
  | "pii-detection"
  | "credential-detection"
  | "memory-poisoning"
  | "code-safety"
  | "exfiltration"
  | "benign";

export interface TestCase {
  /** Unique identifier, e.g. "pi-001" */
  id: string;
  /** Top-level category */
  category: Category;
  /** More specific classification within the category */
  subcategory: string;
  /** The raw input string to scan */
  input: string;
  /** Whether the scanner SHOULD detect this as harmful */
  expected_detection: boolean;
  /** How severe the threat is (only meaningful when expected_detection=true) */
  severity: Severity;
  /** Attribution -- OWASP ref, CVE, research paper, etc. */
  source: string;
  /** Human-readable explanation of what the test case checks */
  description: string;
}

// ── Scanner Adapter ───────────────────────────────────────────────────────────

export interface ScanResult {
  /** Did the scanner flag this input? */
  detected: boolean;
  /** Which category the scanner thinks this belongs to (optional) */
  category?: string;
  /** Scanner's confidence score, 0–1 (optional) */
  confidence?: number;
}

export interface ScannerAdapter {
  /** Human-readable scanner name, e.g. "aegis" */
  name: string;
  /** Scanner version string, e.g. "0.5.0" */
  version: string;
  /** Run the scanner against a single input string */
  scan(input: string): Promise<ScanResult>;
}

// ── Benchmark Results ─────────────────────────────────────────────────────────

export interface CategoryScore {
  precision: number;
  recall: number;
  f1: number;
  true_positives: number;
  false_positives: number;
  true_negatives: number;
  false_negatives: number;
  total: number;
}

export interface BenchmarkResult {
  scanner: string;
  scanner_version: string;
  benchmark_version: string;
  timestamp: string;
  overall: {
    precision: number;
    recall: number;
    f1: number;
  };
  categories: Record<string, CategoryScore>;
  total_cases: number;
  true_positives: number;
  false_positives: number;
  true_negatives: number;
  false_negatives: number;
  /** Per-case results for debugging */
  details: CaseResult[];
}

export interface CaseResult {
  id: string;
  category: Category;
  expected: boolean;
  actual: boolean;
  correct: boolean;
  confidence?: number;
}
