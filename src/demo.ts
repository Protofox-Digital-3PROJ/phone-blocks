/**
 * @file demo.ts
 * @description Demo script for the phone block registry.
 *
 * Run with: `npm run dev` (uses tsx for on-the-fly transpilation)
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PhoneBlockRegistry } from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");

// ─── Loading ────────────────────────────────────────────────────────────────────

console.log("📂 Loading ARCEP files…");
const registry = PhoneBlockRegistry.fromFiles(
	join(DATA_DIR, "MAJNUM.csv"),
	join(DATA_DIR, "MAJRIO.csv"),
);

// ─── Statistics ─────────────────────────────────────────────────────────────────

const stats = registry.getStats();
console.log("\n📊 Registry statistics");
console.log("─".repeat(40));
console.log(
	`  Loaded blocks       : ${stats.totalBlocks.toLocaleString("fr-FR")}`,
);
console.log(`  Operators           : ${stats.totalOperators}`);
console.log(
	`  Covered numbers     : ${stats.totalNumbers.toLocaleString("fr-FR")}`,
);
console.log(`  Blocks w/o operator : ${stats.blocksWithUnknownOperator}`);

// ─── Lookup examples ───────────────────────────────────────────────────────────

const testNumbers = [
	"0612345678",
	"+33 6 12 34 56 78",
	"0123456789",
	"0800 000 000",
	"0699999999",
	"9999999999", // invalid
];

console.log("\n🔍 Number lookups");
console.log("─".repeat(40));
for (const num of testNumbers) {
	const result = registry.lookup(num);
	if (!result.block) {
		console.log(`  ${num.padEnd(22)} → ❌ not found`);
	} else {
		const op = result.block.operatorName ?? result.block.operatorCode;
		const territoire = result.block.territoire;
		console.log(`  ${num.padEnd(22)} → ✅ ${op} (${territoire})`);
	}
}

// ─── Operator listing ──────────────────────────────────────────────────────────

console.log("\n📋 First 10 operators (alphabetical order)");
console.log("─".repeat(40));
const operators = registry.getOperators().slice(0, 10);
for (const op of operators) {
	console.log(`  ${op.code.padEnd(8)} → ${op.name}`);
}

// ─── Blocks for a specific operator ────────────────────────────────────────────

const TARGET_CODE = "FRTE";
const orangeBlocks = registry.getBlocksByOperator(TARGET_CODE);
console.log(
	`\n📞 ${TARGET_CODE} (Orange) blocks: ${orangeBlocks.length} ranges`,
);
console.log("─".repeat(40));
orangeBlocks.slice(0, 5).forEach((b) => {
	console.log(
		`  EZABPQM ${b.id} : ${b.rangeStart} → ${b.rangeEnd}  (${b.territoire})`,
	);
});
if (orangeBlocks.length > 5) {
	console.log(`  … and ${orangeBlocks.length - 5} more`);
}
