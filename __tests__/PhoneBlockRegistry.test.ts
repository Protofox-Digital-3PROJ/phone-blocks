/**
 * @file PhoneBlockRegistry.test.ts
 * @description Unit tests for the PhoneBlockRegistry class.
 *
 * Covers:
 * - The `fromRaw` factory (synthetic data)
 * - The `fromFiles` factory (real data.gouv.fr files)
 * - Phone number normalization
 * - Binary search (`lookup`)
 * - Operator queries (`getBlocksByOperator`)
 * - Operator listing (`getOperators`)
 * - Statistics (`getStats`)
 * - Edge cases and invalid values
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { PhoneBlockRegistry } from "../src/PhoneBlockRegistry";
import { MNC_ENTRIES, NUM_BLOCKS, OPERATORS, PORTABILITY_ENTRIES, SHORT_NUMBER_BLOCKS } from "./fixtures.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");

// ─── Registry built from fixtures ───────────────────────────────────────────────

describe("PhoneBlockRegistry — fromRaw (synthetic fixtures)", () => {
	const registry = PhoneBlockRegistry.fromRaw(NUM_BLOCKS, OPERATORS);

	// ── Construction ────────────────────────────────────────────────────────────

	describe("construction", () => {
		it("loads the correct number of blocks", () => {
			expect(registry.size).toBe(4);
		});

		it("resolves operator names from MAJRIO", () => {
			const { block } = registry.lookup("0600000000");
			expect(block?.operatorName).toBe("Orange");
		});

		it("exposes `null` for an operator code absent from MAJRIO", () => {
			const { block } = registry.lookup("0800000000");
			expect(block?.operatorCode).toBe("UNKN");
			expect(block?.operatorName).toBeNull();
		});
	});

	// ── Number normalization ────────────────────────────────────────────────────────

	describe("lookup — format normalization", () => {
		const cases: Array<[string, string | null]> = [
			["0612345678", "612345678"], // standard format
			["+33612345678", "612345678"], // E.164 without spaces
			["+33 6 12 34 56 78", "612345678"], // E.164 with spaces
			["06-12-34-56-78", "612345678"], // dashes
			["06.12.34.56.78", "612345678"], // dots
			["6 12 34 56 78", "612345678"], // 9 digits with spaces
		];

		it.each(cases)("normalizes « %s » → %s", (input, expected) => {
			const result = registry.lookup(input);
			expect(result.normalizedNumber).toBe(expected ?? input);
		});
	});

	// ── Valid lookups ─────────────────────────────────────────────────────────────

	describe("lookup — numbers within ranges", () => {
		it("finds the first number of a range (lower bound)", () => {
			const { block } = registry.lookup("0600000000");
			expect(block).not.toBeNull();
			expect(block!.operatorCode).toBe("FRTE");
		});

		it("finds the last number of a range (upper bound)", () => {
			const { block } = registry.lookup("0609999999");
			expect(block?.operatorCode).toBe("FRTE");
		});

		it("finds a number in the middle of a range", () => {
			const { block } = registry.lookup("0615000000");
			expect(block?.operatorCode).toBe("SFR0");
			expect(block?.operatorName).toBe("Société française du radiotéléphone");
		});

		it("finds a number in a DOM range", () => {
			const { block } = registry.lookup("0700000001");
			expect(block?.operatorCode).toBe("BYGT");
			expect(block?.territoire).toBe("DOM");
		});

		it("returns the correct territory", () => {
			const { block } = registry.lookup("0700000000");
			expect(block?.territoire).toBe("DOM");
		});

		it("returns a valid assignment date", () => {
			const { block } = registry.lookup("0600000000");
			expect(block?.attributedAt).toBeInstanceOf(Date);
			expect(block?.attributedAt.getFullYear()).toBe(2017);
		});
	});

	// ── Numbers outside ranges ─────────────────────────────────────────────────────

	describe("lookup — numbers outside ranges", () => {
		it("returns null for a number between two ranges", () => {
			const { block } = registry.lookup("0650000000");
			expect(block).toBeNull();
		});

		it("returns null for a number before all ranges", () => {
			const { block } = registry.lookup("0100000000");
			expect(block).toBeNull();
		});

		it("returns null for a number after all ranges", () => {
			const { block } = registry.lookup("0999999999");
			expect(block).toBeNull();
		});
	});

	// ── Invalid inputs ────────────────────────────────────────────────────────────

	describe("lookup — invalid inputs", () => {
		it("returns block=null for an empty string", () => {
			expect(registry.lookup("").block).toBeNull();
		});

		it("returns block=null for a number that is too short", () => {
			expect(registry.lookup("0612").block).toBeNull();
		});

		it("returns block=null for a number that is too long", () => {
			expect(registry.lookup("06123456789").block).toBeNull();
		});

		it("returns block=null for non-numeric characters", () => {
			expect(registry.lookup("abcdefghij").block).toBeNull();
		});

		it("preserves original input in normalizedNumber when format is invalid", () => {
			const result = registry.lookup("INVALID");
			expect(result.normalizedNumber).toBe("INVALID");
		});
	});

	// ── getBlocksByOperator ──────────────────────────────────────────────────────

	describe("getBlocksByOperator", () => {
		it("returns blocks for a known operator", () => {
			const blocks = registry.getBlocksByOperator("FRTE");
			expect(blocks).toHaveLength(1);
			expect(blocks[0]!.rangeStart).toBe(600000000);
		});

		it("is case-insensitive", () => {
			const lower = registry.getBlocksByOperator("frte");
			const upper = registry.getBlocksByOperator("FRTE");
			expect(lower).toHaveLength(upper.length);
		});

		it("returns an empty array for an unknown code", () => {
			expect(registry.getBlocksByOperator("XXXX")).toHaveLength(0);
		});
	});

	// ── getOperators ─────────────────────────────────────────────────────────────

	describe("getOperators", () => {
		it("returns all operators from MAJRIO", () => {
			const ops = registry.getOperators();
			expect(ops).toHaveLength(OPERATORS.length);
		});

		it("is sorted by alphabetical code", () => {
			const ops = registry.getOperators();
			const codes = ops.map((o) => o.code);
			expect(codes).toEqual([...codes].sort());
		});

		it("each entry has code and name", () => {
			for (const op of registry.getOperators()) {
				expect(op.code).toBeTruthy();
				expect(op.name).toBeTruthy();
			}
		});
	});

	// ── getStats ─────────────────────────────────────────────────────────────────

	describe("getStats", () => {
		it("counts the correct number of blocks", () => {
			expect(registry.getStats().totalBlocks).toBe(4);
		});

		it("counts the correct number of operators", () => {
			expect(registry.getStats().totalOperators).toBe(OPERATORS.length);
		});

		it("correctly calculates the total number count", () => {
			// (609999999-600000000+1) + (619999999-610000000+1)
			// + (709999999-700000000+1) + (800000000-800000000+1)
			const expected = 10_000_000 + 10_000_000 + 10_000_000 + 1;
			expect(registry.getStats().totalNumbers).toBe(expected);
		});

		it("counts blocks without a known operator", () => {
			// UNKN is not in MAJRIO → 1 block without operator
			expect(registry.getStats().blocksWithUnknownOperator).toBe(1);
		});
	});
});

// ─── Registry built from real files ─────────────────────────────────────────────

describe("PhoneBlockRegistry — fromFiles (real ARCEP data)", () => {
	let registry: PhoneBlockRegistry;

	beforeAll(() => {
		registry = PhoneBlockRegistry.fromFiles(
			join(DATA_DIR, "MAJNUM.csv"),
			join(DATA_DIR, "MAJRIO.csv"),
		);
	});

	it("loads more than 10,000 blocks", () => {
		expect(registry.size).toBeGreaterThan(10_000);
	});

	it("resolves the operator on a known 06 mobile number", () => {
		const { block } = registry.lookup("0612345678");
		expect(block).not.toBeNull();
		expect(block!.operatorName).toBeTruthy();
	});

	it("resolves Bouygues Telecom on a known 07 number", () => {
		const { block } = registry.lookup("0750000000");
		expect(block).not.toBeNull();
		expect(block!.operatorName).toBe("Bouygues Telecom");
	});

	it("resolves Orange on number 0800000000 (special services)", () => {
		const { block } = registry.lookup("0800000000");
		expect(block).not.toBeNull();
		expect(block!.operatorName).toBe("Orange");
	});

	it("returns null for an impossible number", () => {
		expect(registry.lookup("0000000000").block).toBeNull();
	});

	it("covers more than 400 million numbers", () => {
		expect(registry.getStats().totalNumbers).toBeGreaterThan(400_000_000);
	});

	it("lists at least 100 distinct operators", () => {
		expect(registry.getOperators().length).toBeGreaterThan(100);
	});
});

// ─── New datasets ───────────────────────────────────────────────────────────────

describe("PhoneBlockRegistry — short numbers (MAJNFB)", () => {
	const registry = PhoneBlockRegistry.fromRaw(NUM_BLOCKS, OPERATORS, {
		rawShortNumbers: SHORT_NUMBER_BLOCKS,
	});

	it("finds exact short number (15)", () => {
		const result = registry.lookupShortNumber("15");
		expect(result.block).not.toBeNull();
		expect(result.block!.operatorCode).toBe("FRTE");
	});

	it("finds short number in a range (3050)", () => {
		const result = registry.lookupShortNumber("3050");
		expect(result.block).not.toBeNull();
		expect(result.block!.operatorCode).toBe("SFR0");
	});

	it("returns null for unknown short number", () => {
		expect(registry.lookupShortNumber("999").block).toBeNull();
	});

	it("returns null for non-numeric input", () => {
		expect(registry.lookupShortNumber("abc").block).toBeNull();
	});
});

describe("PhoneBlockRegistry — MCC-MNC (MAJMNC)", () => {
	const registry = PhoneBlockRegistry.fromRaw(NUM_BLOCKS, OPERATORS, {
		rawMnc: MNC_ENTRIES,
	});

	it("looks up a known MCC-MNC", () => {
		const mnc = registry.lookupMobileNetworkCode("20801");
		expect(mnc).not.toBeNull();
		expect(mnc!.operatorName).toBe("Orange France");
	});

	it("returns null for unknown MCC-MNC", () => {
		expect(registry.lookupMobileNetworkCode("99999")).toBeNull();
	});

	it("lists all MCC-MNC entries sorted", () => {
		const all = registry.getMobileNetworkCodes();
		expect(all).toHaveLength(2);
		expect(all[0]!.mccMnc).toBe("20801");
		expect(all[1]!.mccMnc).toBe("20810");
	});
});

describe("PhoneBlockRegistry — portability (MAJPORTA)", () => {
	const registry = PhoneBlockRegistry.fromRaw(NUM_BLOCKS, OPERATORS, {
		rawPortability: PORTABILITY_ENTRIES,
	});

	it("looks up portability for a known block", () => {
		const entry = registry.lookupPortability("6000");
		expect(entry).not.toBeNull();
		expect(entry!.operatorCode).toBe("SFR0");
		expect(entry!.operatorName).toBe("Société française du radiotéléphone");
	});

	it("returns null for unknown block", () => {
		expect(registry.lookupPortability("9999")).toBeNull();
	});

	it("resolves operator name from operator index", () => {
		const entry = registry.lookupPortability("7000");
		expect(entry!.operatorName).toBe("Orange");
	});
});
