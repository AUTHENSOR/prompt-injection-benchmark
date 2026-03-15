#!/usr/bin/env node

/**
 * PIB — CLI
 *
 * Usage:
 *   pib run --scanner aegis           # Run benchmark with Aegis
 *   pib run --scanner ./my-scanner.js # Run with custom scanner module
 *   pib list                          # List available benchmark versions
 *   pib validate                      # Validate all test cases
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runBenchmark, loadTestCases } from "./runners/run-benchmark.js";
import { formatResultTable } from "./scoring/score.js";
import type { ScannerAdapter } from "./runners/runner-interface.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BENCHMARK_ROOT = join(__dirname, "benchmark");
const RESULTS_DIR = join(__dirname, "results");

// ── Argument Parsing ──────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { command: string; flags: Record<string, string> } {
  const args = argv.slice(2);
  const command = args[0] ?? "help";
  const flags: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      flags[key] = value;
    }
  }

  return { command, flags };
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function commandRun(flags: Record<string, string>): Promise<void> {
  const scannerName = flags["scanner"];
  const version = flags["version"] ?? "v1";

  if (!scannerName) {
    console.error("  Error: --scanner is required\n");
    console.error("  Usage: pib run --scanner aegis");
    console.error("         pib run --scanner ./my-scanner.js\n");
    process.exit(1);
  }

  let adapter: ScannerAdapter;

  if (scannerName === "aegis") {
    // Built-in Aegis adapter
    const mod = await import("./runners/run-aegis.js");
    // The aegis runner runs itself, so we re-implement the adapter inline
    let aegis: any;
    try {
      aegis = await import("@authensor/aegis");
    } catch {
      console.error(
        "\n  Error: @authensor/aegis is not installed.\n" +
          "  Install it with: npm install @authensor/aegis\n",
      );
      process.exit(1);
    }
    adapter = {
      name: "aegis",
      version: aegis.version ?? "unknown",
      async scan(input: string) {
        const result = aegis.scan(input);
        return {
          detected: result.flagged,
          category: result.categories?.[0],
          confidence: result.score,
        };
      },
    };
  } else {
    // Load custom scanner module
    const modulePath = resolve(process.cwd(), scannerName);
    try {
      const mod = await import(modulePath);
      adapter = mod.default ?? mod.scanner ?? mod;
      if (!adapter.name || !adapter.scan) {
        console.error(
          "\n  Error: Scanner module must export { name, version, scan }.\n" +
            "  See runners/runner-interface.ts for the ScannerAdapter interface.\n",
        );
        process.exit(1);
      }
    } catch (err) {
      console.error(`\n  Error loading scanner module: ${modulePath}\n`);
      console.error(`  ${err}\n`);
      process.exit(1);
    }
  }

  console.log(`\n  Running PIB ${version} with ${adapter.name} v${adapter.version}...\n`);

  const result = await runBenchmark(adapter, version, {
    onProgress(completed, total, caseId) {
      const pct = ((completed / total) * 100).toFixed(0);
      process.stdout.write(`\r  [${pct}%] ${completed}/${total} — ${caseId}`);
    },
  });

  process.stdout.write("\r" + " ".repeat(80) + "\r");
  console.log(formatResultTable(result));

  // Write results
  await mkdir(RESULTS_DIR, { recursive: true });
  const outPath = join(RESULTS_DIR, `${adapter.name}-${version}.json`);
  await writeFile(outPath, JSON.stringify(result, null, 2));
  console.log(`  Results written to: ${outPath}\n`);
}

async function commandList(): Promise<void> {
  const versions = await readdir(BENCHMARK_ROOT, { withFileTypes: true });
  console.log("\n  Available benchmark versions:\n");

  for (const v of versions) {
    if (!v.isDirectory()) continue;
    const manifestPath = join(BENCHMARK_ROOT, "..", "benchmark", "manifest.json");
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
      console.log(`  ${v.name} — ${manifest.description ?? "No description"}`);
    } catch {
      console.log(`  ${v.name}`);
    }
  }
  console.log("");
}

async function commandValidate(): Promise<void> {
  const version = "v1";
  console.log(`\n  Validating PIB ${version} test cases...\n`);

  const cases = await loadTestCases(version);
  const ids = new Set<string>();
  let errors = 0;

  for (const tc of cases) {
    // Check for duplicate IDs
    if (ids.has(tc.id)) {
      console.error(`  ERROR: Duplicate ID: ${tc.id}`);
      errors++;
    }
    ids.add(tc.id);

    // Check required fields
    if (!tc.id || !tc.category || !tc.input || tc.expected_detection === undefined) {
      console.error(`  ERROR: Missing required fields in: ${tc.id}`);
      errors++;
    }

    // Check severity
    if (!["critical", "high", "medium", "low", "info"].includes(tc.severity)) {
      console.error(`  ERROR: Invalid severity "${tc.severity}" in: ${tc.id}`);
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`\n  ${errors} error(s) found.\n`);
    process.exit(1);
  }

  console.log(`  ${cases.length} test cases validated. No errors.\n`);
}

function commandHelp(): void {
  console.log(`
  PIB — Prompt Injection Benchmark
  From 15 Research Lab

  Usage:
    pib run --scanner <name|path>  Run benchmark with a scanner
    pib run --scanner aegis        Run with Authensor Aegis
    pib list                       List benchmark versions
    pib validate                   Validate all test cases
    pib help                       Show this help

  Options:
    --scanner    Scanner name (aegis) or path to module
    --version    Benchmark version (default: v1)

  Examples:
    npx pib run --scanner aegis
    npx pib run --scanner ./my-scanner.js --version v1
`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const { command, flags } = parseArgs(process.argv);

switch (command) {
  case "run":
    await commandRun(flags);
    break;
  case "list":
    await commandList();
    break;
  case "validate":
    await commandValidate();
    break;
  case "help":
  default:
    commandHelp();
    break;
}
