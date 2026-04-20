/**
 * @module PhoneBlockRegistry
 * @description Registre principal des blocs de numéros téléphoniques français.
 *
 * Charge et indexe les fichiers MAJNUM et MAJRIO publiés par l'ARCEP sur
 * data.gouv.fr, puis expose des méthodes de recherche efficaces.
 *
 * @example
 * ```ts
 * import { PhoneBlockRegistry } from "./PhoneBlockRegistry.js";
 *
 * const registry = PhoneBlockRegistry.fromFiles(
 *   "./data/MAJNUM.csv",
 *   "./data/MAJRIO.csv"
 * );
 *
 * const result = registry.lookup("0612345678");
 * console.log(result.block?.operatorName); // "Orange"
 * ```
 */
import { parseCsv } from "./csv-parser.js";
// ─── Helpers internes ────────────────────────────────────────────────────────
/**
 * Parse une date au format JJ/MM/AAAA en objet `Date`.
 * Retourne `Invalid Date` si la chaîne ne correspond pas au format attendu.
 *
 * @param raw - Chaîne de date brute.
 * @returns Objet `Date`.
 */
function parseFrDate(raw) {
    const [day, month, year] = raw.split("/");
    if (!day || !month || !year)
        return new Date(NaN);
    return new Date(Number(year), Number(month) - 1, Number(day));
}
/**
 * Normalise un numéro de téléphone français en 9 chiffres (sans le `0` initial).
 *
 * Exemples acceptés : `"0612345678"`, `"+33612345678"`, `"612345678"`.
 *
 * @param input - Numéro saisi par l'utilisateur (espaces et tirets tolérés).
 * @returns Chaîne de 9 chiffres, ou `null` si le format est invalide.
 */
function normalizePhoneNumber(input) {
    // Retire tout ce qui n'est pas un chiffre ou +
    const digits = input.replace(/[\s\-\.]/g, "");
    if (/^\+33\d{9}$/.test(digits))
        return digits.slice(3); // +33XXXXXXXXX
    if (/^0\d{9}$/.test(digits))
        return digits.slice(1); // 0XXXXXXXXX
    if (/^\d{9}$/.test(digits))
        return digits; // XXXXXXXXX
    return null;
}
// ─── Classe principale ────────────────────────────────────────────────────────
/**
 * Registre des blocs de numérotation téléphonique français.
 *
 * Encapsule les données MAJNUM (tranches) et MAJRIO (opérateurs) et fournit :
 * - une recherche par numéro (`lookup`)
 * - un listing des opérateurs (`getOperators`)
 * - des statistiques agrégées (`getStats`)
 */
export class PhoneBlockRegistry {
    /** Blocs indexés, triés par `rangeStart` pour la recherche binaire. */
    blocks;
    /** Index opérateurs : code mnémo → nom complet. */
    operatorIndex;
    /**
     * Constructeur privé — utilisez {@link PhoneBlockRegistry.fromFiles} ou
     * {@link PhoneBlockRegistry.fromRaw} pour instancier.
     *
     * @param blocks - Blocs déjà construits et triés.
     * @param operatorIndex - Map code → nom d'opérateur.
     */
    constructor(blocks, operatorIndex) {
        this.blocks = blocks;
        this.operatorIndex = operatorIndex;
    }
    // ─── Factories ─────────────────────────────────────────────────────────────
    /**
     * Construit un registre en lisant directement les fichiers CSV de l'ARCEP.
     *
     * @param majnumPath - Chemin vers `MAJNUM.csv`.
     * @param majrioPath - Chemin vers `MAJRIO.csv`.
     * @returns Instance de {@link PhoneBlockRegistry} prête à l'emploi.
     *
     * @throws {Error} Si l'un des fichiers est illisible ou mal formé.
     *
     * @example
     * ```ts
     * const registry = PhoneBlockRegistry.fromFiles(
     *   "./data/MAJNUM.csv",
     *   "./data/MAJRIO.csv"
     * );
     * ```
     */
    static fromFiles(majnumPath, majrioPath) {
        const rawBlocks = parseCsv(majnumPath);
        const rawOperators = parseCsv(majrioPath);
        return PhoneBlockRegistry.fromRaw(rawBlocks, rawOperators);
    }
    /**
     * Construit un registre depuis des données déjà parsées (utile pour les tests
     * ou les environnements sans accès filesystem).
     *
     * @param rawBlocks - Lignes brutes de MAJNUM.
     * @param rawOperators - Lignes brutes de MAJRIO.
     * @returns Instance de {@link PhoneBlockRegistry}.
     */
    static fromRaw(rawBlocks, rawOperators) {
        // 1. Construit l'index opérateurs : Code Attributaire → Attributaire
        const operatorIndex = new Map();
        for (const op of rawOperators) {
            const code = op["Code Attributaire"]?.trim();
            const name = op["Attributaire"]?.trim();
            if (code && name)
                operatorIndex.set(code, name);
        }
        // 2. Transforme et trie les blocs
        const blocks = rawBlocks
            .map((raw) => {
            const code = String(raw["Mnémo"] ?? raw["MnÃ©mo"] ?? "").trim();
            return {
                id: Number(raw.EZABPQM),
                rangeStart: Number(raw.Tranche_Debut),
                rangeEnd: Number(raw.Tranche_Fin),
                operatorCode: code,
                operatorName: operatorIndex.get(code) ?? null,
                territoire: String(raw.Territoire ?? "").trim(),
                attributedAt: parseFrDate(String(raw.Date_Attribution ?? "").trim()),
            };
        })
            .sort((a, b) => a.rangeStart - b.rangeStart);
        return new PhoneBlockRegistry(blocks, operatorIndex);
    }
    // ─── Méthodes publiques ─────────────────────────────────────────────────────
    /**
     * Recherche le bloc de numérotation auquel appartient un numéro de téléphone.
     *
     * La recherche est effectuée par **dichotomie** (O(log n)) sur les tranches
     * triées par `rangeStart`.
     *
     * @param phoneNumber - Numéro à rechercher (formats acceptés :
     *   `"0612345678"`, `"+33612345678"`, `"6 12 34 56 78"`).
     * @returns {@link LookupResult} avec le bloc trouvé ou `null`.
     *
     * @example
     * ```ts
     * const { block } = registry.lookup("0612345678");
     * if (block) {
     *   console.log(`Opérateur : ${block.operatorName}`);
     * }
     * ```
     */
    lookup(phoneNumber) {
        const normalized = normalizePhoneNumber(phoneNumber);
        if (!normalized) {
            return { normalizedNumber: phoneNumber, block: null };
        }
        // Le numéro interne ARCEP est sur 9 chiffres → on compare directement
        const numericValue = Number(normalized);
        const block = this.binarySearch(numericValue);
        return { normalizedNumber: normalized, block };
    }
    /**
     * Retourne tous les blocs appartenant à un opérateur donné.
     *
     * @param operatorCode - Code mnémonique (ex : `"FRTE"`, `"SFR0"`).
     * @returns Tableau de {@link PhoneBlock} (peut être vide).
     */
    getBlocksByOperator(operatorCode) {
        const code = operatorCode.toUpperCase().trim();
        return this.blocks.filter((b) => b.operatorCode === code);
    }
    /**
     * Liste tous les opérateurs présents dans MAJRIO.
     *
     * @returns Tableau de paires `{ code, name }` triées par code.
     */
    getOperators() {
        return Array.from(this.operatorIndex.entries())
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.code.localeCompare(b.code));
    }
    /**
     * Retourne des statistiques globales sur le registre chargé.
     *
     * @returns Objet de statistiques.
     *
     * @example
     * ```ts
     * const stats = registry.getStats();
     * console.log(`${stats.totalBlocks} blocs, ${stats.totalOperators} opérateurs`);
     * ```
     */
    getStats() {
        let totalNumbers = 0;
        let blocksWithUnknownOperator = 0;
        for (const block of this.blocks) {
            totalNumbers += block.rangeEnd - block.rangeStart + 1;
            if (!block.operatorName)
                blocksWithUnknownOperator++;
        }
        return {
            totalBlocks: this.blocks.length,
            totalOperators: this.operatorIndex.size,
            totalNumbers,
            blocksWithUnknownOperator,
        };
    }
    /**
     * Nombre total de blocs chargés.
     */
    get size() {
        return this.blocks.length;
    }
    // ─── Méthodes privées ───────────────────────────────────────────────────────
    /**
     * Recherche dichotomique d'un numéro dans les tranches triées.
     *
     * @param value - Valeur numérique du numéro (9 chiffres sans le `0`).
     * @returns Le {@link PhoneBlock} correspondant, ou `null`.
     */
    binarySearch(value) {
        let lo = 0;
        let hi = this.blocks.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >>> 1;
            const block = this.blocks[mid];
            if (value < block.rangeStart) {
                hi = mid - 1;
            }
            else if (value > block.rangeEnd) {
                lo = mid + 1;
            }
            else {
                return block;
            }
        }
        return null;
    }
}
