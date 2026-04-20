/**
 * @module PhoneBlockRegistry
 * @description Main registry for French phone number blocks.
 *
 * Loads and indexes the MAJNUM and MAJRIO files published by ARCEP on
 * data.gouv.fr, then exposes efficient lookup methods.
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
import type {
	LookupResult,
	PhoneBlock,
	RawNumBlock,
	RawOperator,
} from "./types.js";

// ─── Internal helpers ────────────────────────────────────────────────────────────

/**
 * Parses a date in DD/MM/YYYY format into a `Date` object.
 * Returns `Invalid Date` if the string does not match the expected format.
 *
 * @param raw - Raw date string.
 * @returns `Date` object.
 */
function parseFrDate(raw: string): Date {
	const [day, month, year] = raw.split("/");
	if (!day || !month || !year) return new Date(NaN);
	return new Date(Number(year), Number(month) - 1, Number(day));
}

/**
 * Normalizes a French phone number to 9 digits (without the leading `0`).
 *
 * Accepted formats: `"0612345678"`, `"+33612345678"`, `"612345678"`.
 *
 * @param input - User-entered number (spaces and dashes are tolerated).
 * @returns 9-digit string, or `null` if the format is invalid.
 */
function normalizePhoneNumber(input: string): string | null {
	// Remove everything that is not a digit or +
	const digits = input.replace(/[\s\-.]/g, "");

	if (/^\+33\d{9}$/.test(digits)) return digits.slice(3); // +33XXXXXXXXX
	if (/^0\d{9}$/.test(digits)) return digits.slice(1); // 0XXXXXXXXX
	if (/^\d{9}$/.test(digits)) return digits; // XXXXXXXXX

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
	private readonly blocks: PhoneBlock[];

	/** Index opérateurs : code mnémo → nom complet. */
	private readonly operatorIndex: ReadonlyMap<string, string>;

	/**
	 * Constructeur privé — utilisez {@link PhoneBlockRegistry.fromFiles} ou
	 * {@link PhoneBlockRegistry.fromRaw} pour instancier.
	 *
	 * @param blocks - Blocs déjà construits et triés.
	 * @param operatorIndex - Map code → nom d'opérateur.
	 */
	private constructor(
		blocks: PhoneBlock[],
		operatorIndex: Map<string, string>,
	) {
		this.blocks = blocks;
		this.operatorIndex = operatorIndex;
	}

	// ─── Factories ─────────────────────────────────────────────────────────────

	/**
	 * Builds a registry by reading ARCEP CSV files directly.
	 *
	 * @param majnumPath - Path to `MAJNUM.csv`.
	 * @param majrioPath - Path to `MAJRIO.csv`.
	 * @returns Ready-to-use {@link PhoneBlockRegistry} instance.
	 *
	 * @throws {Error} If either file is unreadable or malformed.
	 *
	 * @example
	 * ```ts
	 * const registry = PhoneBlockRegistry.fromFiles(
	 *   "./data/MAJNUM.csv",
	 *   "./data/MAJRIO.csv"
	 * );
	 * ```
	 */
	static fromFiles(majnumPath: string, majrioPath: string): PhoneBlockRegistry {
		const rawBlocks = parseCsv(majnumPath) as unknown as RawNumBlock[];
		const rawOperators = parseCsv(majrioPath) as unknown as RawOperator[];
		return PhoneBlockRegistry.fromRaw(rawBlocks, rawOperators);
	}

	/**
	 * Builds a registry from pre-parsed data (useful for tests
	 * or environments without filesystem access).
	 *
	 * @param rawBlocks - Raw MAJNUM rows.
	 * @param rawOperators - Raw MAJRIO rows.
	 * @returns {@link PhoneBlockRegistry} instance.
	 */
	static fromRaw(
		rawBlocks: RawNumBlock[],
		rawOperators: RawOperator[],
	): PhoneBlockRegistry {
		// 1. Build operator index: Code Attributaire → Attributaire
		const operatorIndex = new Map<string, string>();
		for (const op of rawOperators) {
			const code = op["Code Attributaire"]?.trim();
			const name = op.Attributaire?.trim();
			if (code && name) operatorIndex.set(code, name);
		}

		// 2. Transform and sort blocks
		const blocks: PhoneBlock[] = rawBlocks
			.map((raw): PhoneBlock => {
				const code = String(raw.Mnémo ?? "").trim();
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

	// ─── Public methods ───────────────────────────────────────────────────────────

	/**
	 * Finds the number block to which a phone number belongs.
	 *
	 * The search is performed using **binary search** (O(log n)) on ranges
	 * sorted by `rangeStart`.
	 *
	 * @param phoneNumber - Number to look up (accepted formats:
	 *   `"0612345678"`, `"+33612345678"`, `"6 12 34 56 78"`).
	 * @returns {@link LookupResult} with the found block or `null`.
	 *
	 * @example
	 * ```ts
	 * const { block } = registry.lookup("0612345678");
	 * if (block) {
	 *   console.log(`Operator: ${block.operatorName}`);
	 * }
	 * ```
	 */
	lookup(phoneNumber: string): LookupResult {
		const normalized = normalizePhoneNumber(phoneNumber);
		if (!normalized) {
			return { normalizedNumber: phoneNumber, block: null };
		}

		// The internal ARCEP number is 9 digits → compare directly
		const numericValue = Number(normalized);
		const block = this.binarySearch(numericValue);

		return { normalizedNumber: normalized, block };
	}

	/**
	 * Returns all blocks belonging to a given operator.
	 *
	 * @param operatorCode - Mnemonic code (e.g. `"FRTE"`, `"SFR0"`).
	 * @returns Array of {@link PhoneBlock} (may be empty).
	 */
	getBlocksByOperator(operatorCode: string): PhoneBlock[] {
		const code = operatorCode.toUpperCase().trim();
		return this.blocks.filter((b) => b.operatorCode === code);
	}

	/**
	 * Lists all operators present in MAJRIO.
	 *
	 * @returns Array of `{ code, name }` pairs sorted by code.
	 */
	getOperators(): Array<{ code: string; name: string }> {
		return Array.from(this.operatorIndex.entries())
			.map(([code, name]) => ({ code, name }))
			.sort((a, b) => a.code.localeCompare(b.code));
	}

	/**
	 * Returns global statistics about the loaded registry.
	 *
	 * @returns Statistics object.
	 *
	 * @example
	 * ```ts
	 * const stats = registry.getStats();
	 * console.log(`${stats.totalBlocks} blocks, ${stats.totalOperators} operators`);
	 * ```
	 */
	getStats(): {
		totalBlocks: number;
		totalOperators: number;
		totalNumbers: number;
		blocksWithUnknownOperator: number;
	} {
		let totalNumbers = 0;
		let blocksWithUnknownOperator = 0;

		for (const block of this.blocks) {
			totalNumbers += block.rangeEnd - block.rangeStart + 1;
			if (!block.operatorName) blocksWithUnknownOperator++;
		}

		return {
			totalBlocks: this.blocks.length,
			totalOperators: this.operatorIndex.size,
			totalNumbers,
			blocksWithUnknownOperator,
		};
	}

	/**
	 * Total number of loaded blocks.
	 */
	get size(): number {
		return this.blocks.length;
	}

	// ─── Private methods ──────────────────────────────────────────────────────────

	/**
	 * Binary search for a number within the sorted ranges.
	 *
	 * @param value - Numeric value of the number (9 digits without the `0`).
	 * @returns The matching {@link PhoneBlock}, or `null`.
	 */
	private binarySearch(value: number): PhoneBlock | null {
		let lo = 0;
		let hi = this.blocks.length - 1;

		while (lo <= hi) {
			const mid = (lo + hi) >>> 1;
			const block = this.blocks[mid]!;

			if (value < block.rangeStart) {
				hi = mid - 1;
			} else if (value > block.rangeEnd) {
				lo = mid + 1;
			} else {
				return block;
			}
		}

		return null;
	}
}
