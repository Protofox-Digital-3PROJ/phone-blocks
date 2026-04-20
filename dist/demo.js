/**
 * @file demo.ts
 * @description Script de démonstration du registre téléphonique.
 *
 * Exécution : `npm run dev` (utilise tsx pour la transpilation à la volée)
 */
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { PhoneBlockRegistry } from "./index.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
// ─── Chargement ──────────────────────────────────────────────────────────────
console.log("📂 Chargement des fichiers ARCEP…");
const registry = PhoneBlockRegistry.fromFiles(join(DATA_DIR, "MAJNUM.csv"), join(DATA_DIR, "MAJRIO.csv"));
// ─── Statistiques ────────────────────────────────────────────────────────────
const stats = registry.getStats();
console.log("\n📊 Statistiques du registre");
console.log("─".repeat(40));
console.log(`  Blocs chargés       : ${stats.totalBlocks.toLocaleString("fr-FR")}`);
console.log(`  Opérateurs          : ${stats.totalOperators}`);
console.log(`  Numéros couverts    : ${stats.totalNumbers.toLocaleString("fr-FR")}`);
console.log(`  Blocs sans opérateur: ${stats.blocksWithUnknownOperator}`);
// ─── Exemples de lookups ─────────────────────────────────────────────────────
const testNumbers = [
    "0612345678",
    "+33 6 12 34 56 78",
    "0123456789",
    "0800 000 000",
    "0699999999",
    "9999999999", // invalide
];
console.log("\n🔍 Recherches par numéro");
console.log("─".repeat(40));
for (const num of testNumbers) {
    const result = registry.lookup(num);
    if (!result.block) {
        console.log(`  ${num.padEnd(22)} → ❌ non trouvé`);
    }
    else {
        const op = result.block.operatorName ?? result.block.operatorCode;
        const territoire = result.block.territoire;
        console.log(`  ${num.padEnd(22)} → ✅ ${op} (${territoire})`);
    }
}
// ─── Listing opérateurs ───────────────────────────────────────────────────────
console.log("\n📋 10 premiers opérateurs (ordre alphabétique)");
console.log("─".repeat(40));
const operators = registry.getOperators().slice(0, 10);
for (const op of operators) {
    console.log(`  ${op.code.padEnd(8)} → ${op.name}`);
}
// ─── Blocs d'un opérateur spécifique ─────────────────────────────────────────
const TARGET_CODE = "FRTE";
const orangeBlocks = registry.getBlocksByOperator(TARGET_CODE);
console.log(`\n📞 Blocs de ${TARGET_CODE} (Orange) : ${orangeBlocks.length} tranches`);
console.log("─".repeat(40));
orangeBlocks.slice(0, 5).forEach((b) => {
    console.log(`  EZABPQM ${b.id} : ${b.rangeStart} → ${b.rangeEnd}  (${b.territoire})`);
});
if (orangeBlocks.length > 5) {
    console.log(`  … et ${orangeBlocks.length - 5} autres`);
}
