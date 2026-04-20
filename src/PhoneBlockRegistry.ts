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

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-parser.js";
import type {
	FrozenBlock,
	LookupResult,
	MobileNetworkCode,
	PhoneBlock,
	PortabilityEntry,
	RawFrozenBlock,
	RawMobileNetworkCode,
	RawNumBlock,
	RawOperator,
	RawPortability,
	ShortNumberLookupResult,
} from "./types.js";

// ─── Internal helpers ────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = join(__dirname, "..", "data");

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

	/** Short/special number blocks (MAJNFB), sorted by rangeStart. */
	private readonly shortNumberBlocks: PhoneBlock[];

	/** Mobile Network Codes (MAJMNC), indexed by MCC-MNC. */
	private readonly mncIndex: ReadonlyMap<string, MobileNetworkCode>;

	/** Portability entries (MAJPORTA), indexed by EZABPQM. */
	private readonly portabilityIndex: ReadonlyMap<string, PortabilityEntry>;

	/** Frozen number blocks (GELNUM), indexed by EZABPQM. */
	private readonly frozenIndex: ReadonlyMap<string, FrozenBlock>;

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
		shortNumberBlocks: PhoneBlock[] = [],
		mncIndex: Map<string, MobileNetworkCode> = new Map(),
		portabilityIndex: Map<string, PortabilityEntry> = new Map(),
		frozenIndex: Map<string, FrozenBlock> = new Map(),
	) {
		this.blocks = blocks;
		this.operatorIndex = operatorIndex;
		this.shortNumberBlocks = shortNumberBlocks;
		this.mncIndex = mncIndex;
		this.portabilityIndex = portabilityIndex;
		this.frozenIndex = frozenIndex;
	}

	// ─── Factories ─────────────────────────────────────────────────────────────

	/**
	 * Builds a registry by loading all CSV files from a directory.
	 *
	 * Defaults to the bundled `data/` directory shipped with the package.
	 *
	 * @param dataDir - Path to the directory containing ARCEP CSV files.
	 * @returns Ready-to-use {@link PhoneBlockRegistry} instance.
	 *
	 * @example
	 * ```ts
	 * // Use bundled data
	 * const registry = PhoneBlockRegistry.fromDataDir();
	 *
	 * // Use custom directory
	 * const registry = PhoneBlockRegistry.fromDataDir("/path/to/data");
	 * ```
	 */
	static fromDataDir(dataDir: string = DEFAULT_DATA_DIR): PhoneBlockRegistry {
		return PhoneBlockRegistry.fromFiles(
			join(dataDir, "MAJNUM.csv"),
			join(dataDir, "MAJRIO.csv"),
			{
				majnfbPath: join(dataDir, "MAJNFB.csv"),
				majmncPath: join(dataDir, "MAJMNC.csv"),
				majportaPath: join(dataDir, "MAJPORTA.csv"),
				gelnumPath: join(dataDir, "GELNUM.csv"),
				extraOperatorPaths: [
					join(dataDir, "MAJCPSN.csv"),
					join(dataDir, "MAJCPSI.csv"),
					join(dataDir, "MAJR1R2.csv"),
					join(dataDir, "MAJSDT.csv"),
				],
			},
		);
	}

	/**
	 * Builds a registry by reading ARCEP CSV files directly.
	 *
	 * @param majnumPath - Path to `MAJNUM.csv`.
	 * @param majrioPath - Path to `MAJRIO.csv`.
	 * @param options - Optional paths to additional ARCEP datasets.
	 * @returns Ready-to-use {@link PhoneBlockRegistry} instance.
	 *
	 * @throws {Error} If a required file is unreadable or malformed.
	 *
	 * @example
	 * ```ts
	 * const registry = PhoneBlockRegistry.fromFiles(
	 *   "./data/MAJNUM.csv",
	 *   "./data/MAJRIO.csv",
	 *   {
	 *     majnfbPath: "./data/MAJNFB.csv",
	 *     majmncPath: "./data/MAJMNC.csv",
	 *     majportaPath: "./data/MAJPORTA.csv",
	 *     extraOperatorPaths: [
	 *       "./data/MAJCPSN.csv",
	 *       "./data/MAJR1R2.csv",
	 *       "./data/MAJSDT.csv",
	 *     ],
	 *   }
	 * );
	 * ```
	 */
	static fromFiles(
		majnumPath: string,
		majrioPath: string,
		options?: {
			majnfbPath?: string;
			majmncPath?: string;
			majportaPath?: string;
			gelnumPath?: string;
			extraOperatorPaths?: string[];
		},
	): PhoneBlockRegistry {
		const rawBlocks = parseCsv(majnumPath) as unknown as RawNumBlock[];
		const rawOperators = parseCsv(majrioPath) as unknown as RawOperator[];

		const rawNfb = options?.majnfbPath
			? (parseCsv(options.majnfbPath) as unknown as RawNumBlock[])
			: undefined;
		const rawMnc = options?.majmncPath
			? (parseCsv(options.majmncPath) as unknown as RawMobileNetworkCode[])
			: undefined;
		const rawPorta = options?.majportaPath
			? (parseCsv(options.majportaPath) as unknown as RawPortability[])
			: undefined;
		const rawFrozen = options?.gelnumPath
			? (parseCsv(options.gelnumPath) as unknown as RawFrozenBlock[])
			: undefined;

		const extraOps: RawOperator[] = [];
		for (const p of options?.extraOperatorPaths ?? []) {
			extraOps.push(...(parseCsv(p) as unknown as RawOperator[]));
		}

		return PhoneBlockRegistry.fromRaw(rawBlocks, rawOperators, {
			rawShortNumbers: rawNfb,
			rawMnc,
			rawPortability: rawPorta,
			rawFrozen,
			extraOperators: extraOps.length > 0 ? extraOps : undefined,
		});
	}

	/**
	 * Builds a registry from pre-parsed data (useful for tests
	 * or environments without filesystem access).
	 *
	 * @param rawBlocks - Raw MAJNUM rows.
	 * @param rawOperators - Raw MAJRIO rows.
	 * @param options - Optional additional datasets.
	 * @returns {@link PhoneBlockRegistry} instance.
	 */
	static fromRaw(
		rawBlocks: RawNumBlock[],
		rawOperators: RawOperator[],
		options?: {
			rawShortNumbers?: RawNumBlock[];
			rawMnc?: RawMobileNetworkCode[];
			rawPortability?: RawPortability[];
			rawFrozen?: RawFrozenBlock[];
			extraOperators?: RawOperator[];
		},
	): PhoneBlockRegistry {
		// 1. Build operator index: Code Attributaire → Attributaire
		const operatorIndex = new Map<string, string>();
		for (const op of rawOperators) {
			const code = op["Code Attributaire"]?.trim();
			const name = op.Attributaire?.trim();
			if (code && name) operatorIndex.set(code, name);
		}

		// Merge extra operator tables (MAJCPSN, MAJR1R2, MAJSDT)
		for (const op of options?.extraOperators ?? []) {
			const code = op["Code Attributaire"]?.trim();
			const name = op.Attributaire?.trim();
			if (code && name && !operatorIndex.has(code)) {
				operatorIndex.set(code, name);
			}
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

		// 3. Build short number blocks (MAJNFB)
		const shortNumberBlocks: PhoneBlock[] = (options?.rawShortNumbers ?? [])
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

		// 4. Build MCC-MNC index (MAJMNC)
		const mncIndex = new Map<string, MobileNetworkCode>();
		for (const raw of options?.rawMnc ?? []) {
			const mccMnc = String(raw["MCC-MNC"] ?? "").trim();
			if (mccMnc) {
				mncIndex.set(mccMnc, {
					mccMnc,
					operatorCode: String(raw.Mnémo ?? "").trim(),
					operatorName: String(raw.Nom ?? "").trim(),
					attributedAt: parseFrDate(String(raw.Date_Attribution ?? "").trim()),
					decision: String(raw.Décision_Attribution ?? "").trim(),
				});
			}
		}

		// 5. Build portability index (MAJPORTA)
		const portabilityIndex = new Map<string, PortabilityEntry>();
		for (const raw of options?.rawPortability ?? []) {
			const blockId = String(raw.EZABPQM ?? "").trim();
			if (blockId) {
				const code = String(raw.Mnémo ?? "").trim();
				portabilityIndex.set(blockId, {
					blockId,
					operatorCode: code,
					operatorName: operatorIndex.get(code) ?? null,
					attributedAt: parseFrDate(String(raw.Date_Attribution ?? "").trim()),
				});
			}
		}

		// 6. Build frozen blocks index (GELNUM)
		const frozenIndex = new Map<string, FrozenBlock>();
		for (const raw of options?.rawFrozen ?? []) {
			const blockId = String(raw.EZABPQM ?? "").trim();
			if (blockId) {
				frozenIndex.set(blockId, {
					blockId,
					type: String(raw.Type ?? "").trim(),
					interestOpensAt: parseFrDate(
						String(raw["Ouverture des manifestations d'intérêts"] ?? "").trim(),
					),
					interestClosesAt: parseFrDate(
						String(raw["Clôture des manifestations d'intérêts"] ?? "").trim(),
					),
					attributionOpensAt: parseFrDate(
						String(raw["Ouverture des demandes d'attribution"] ?? "").trim(),
					),
				});
			}
		}

		return new PhoneBlockRegistry(
			blocks,
			operatorIndex,
			shortNumberBlocks,
			mncIndex,
			portabilityIndex,
			frozenIndex,
		);
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
	 * Looks up a short/special number (e.g. "15", "112", "3008").
	 *
	 * Uses the MAJNFB dataset. The search is performed using binary search.
	 *
	 * @param shortNumber - Short number to look up (as string).
	 * @returns {@link ShortNumberLookupResult} with the found block or `null`.
	 */
	lookupShortNumber(shortNumber: string): ShortNumberLookupResult {
		const num = Number(shortNumber.replace(/\s/g, ""));
		if (Number.isNaN(num)) return { number: shortNumber, block: null };

		let lo = 0;
		let hi = this.shortNumberBlocks.length - 1;
		while (lo <= hi) {
			const mid = (lo + hi) >>> 1;
			const block = this.shortNumberBlocks[mid]!;
			if (num < block.rangeStart) hi = mid - 1;
			else if (num > block.rangeEnd) lo = mid + 1;
			else return { number: shortNumber, block };
		}
		return { number: shortNumber, block: null };
	}

	/**
	 * Looks up a Mobile Network Code (MCC-MNC).
	 *
	 * Uses the MAJMNC dataset.
	 *
	 * @param mccMnc - MCC-MNC identifier (e.g. "20801").
	 * @returns {@link MobileNetworkCode} or `null`.
	 */
	lookupMobileNetworkCode(mccMnc: string): MobileNetworkCode | null {
		return this.mncIndex.get(mccMnc.trim()) ?? null;
	}

	/**
	 * Returns all Mobile Network Code entries.
	 *
	 * @returns Array of {@link MobileNetworkCode} sorted by MCC-MNC.
	 */
	getMobileNetworkCodes(): MobileNetworkCode[] {
		return Array.from(this.mncIndex.values()).sort((a, b) =>
			a.mccMnc.localeCompare(b.mccMnc),
		);
	}

	/**
	 * Looks up the current operator for a block after number portability.
	 *
	 * Uses the MAJPORTA dataset.
	 *
	 * @param blockId - EZABPQM block identifier (e.g. "010000").
	 * @returns {@link PortabilityEntry} or `null`.
	 */
	lookupPortability(blockId: string): PortabilityEntry | null {
		return this.portabilityIndex.get(blockId.trim()) ?? null;
	}

	/**
	 * Looks up a frozen number block by its EZABPQM identifier.
	 *
	 * Uses the GELNUM dataset.
	 *
	 * @param blockId - EZABPQM block identifier (e.g. "08359").
	 * @returns {@link FrozenBlock} or `null`.
	 */
	lookupFrozenBlock(blockId: string): FrozenBlock | null {
		return this.frozenIndex.get(blockId.trim()) ?? null;
	}

	/**
	 * Returns all frozen number blocks.
	 *
	 * @returns Array of {@link FrozenBlock}.
	 */
	getFrozenBlocks(): FrozenBlock[] {
		return Array.from(this.frozenIndex.values());
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
