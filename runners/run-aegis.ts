/**
 * PIB -- Aegis Runner
 *
 * Reference scanner adapter for Authensor Aegis.
 * Install Aegis separately: npm install @authensor/aegis
 *
 * Usage:
 *   pib run --scanner aegis
 *   # or
 *   node dist/runners/run-aegis.js
 */

import type { ScannerAdapter, ScanResult } from "./runner-interface.js";
import { runBenchmark } from "./run-benchmark.js";
import { formatResultTable } from "../scoring/score.js";
import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Aegis Adapter ─────────────────────────────────────────────────────────────

async function createAegisAdapter(): Promise<ScannerAdapter> {
  // Dynamic import so this file can exist even if Aegis isn't installed
  let aegis: { scan: (input: string) => { flagged: boolean; categories: string[]; score: number } };
  let version = "unknown";

  try {
    aegis = await import("@authensor/aegis");
    try {
      const pkg = await import("@authensor/aegis/package.json", {
        with: { type: "json" },
      });
      version = pkg.default?.version ?? "unknown";
    } catch {
      // Version detection failed, continue with "unknown"
    }
  } catch {
    console.error(
      "Error: @authensor/aegis is not installed.\n" +
        "Install it with: npm install @authensor/aegis\n" +
        "Or use the runner interface to create an adapter for your scanner.",
    );
    process.exit(1);
  }

  return {
    name: "aegis",
    version,
    async scan(input: string): Promise<ScanResult> {
      const result = aegis.scan(input);
      return {
        detected: result.flagged,
        category: result.categories?.[0],
        confidence: result.score,
      };
    },
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const adapter = await createAegisAdapter();
  const version = process.argv[2] ?? "v1";

  console.log(`\n  Running PIB ${version} with ${adapter.name} v${adapter.version}...\n`);

  const result = await runBenchmark(adapter, version, {
    onProgress(completed, total, caseId) {
      const pct = ((completed / total) * 100).toFixed(0);
      process.stdout.write(`\r  [${pct}%] ${completed}/${total} -- ${caseId}`);
    },
  });

  process.stdout.write("\r" + " ".repeat(80) + "\r");
  console.log(formatResultTable(result));

  // Write results
  const outPath = join(__dirname, "..", "results", `aegis-${version}.json`);
  await writeFile(outPath, JSON.stringify(result, null, 2));
  console.log(`  Results written to: ${outPath}\n`);
}

main().catch(console.error);
