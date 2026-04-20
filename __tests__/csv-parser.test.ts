/**
 * @file csv-parser.test.ts
 * @description Unit tests for the CSV parser.
 */

import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseCsv } from "../src/csv-parser";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Writes a temporary file and returns its path. */
function writeTmp(name: string, content: string): string {
	const path = join(tmpdir(), name);
	writeFileSync(path, Buffer.from(content, "latin1"));
	return path;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("parseCsv", () => {
	const tmpFiles: string[] = [];

	afterAll(() => {
		for (const f of tmpFiles) {
			try {
				unlinkSync(f);
			} catch {
				/* ignore */
			}
		}
	});

	it("parses a simple CSV with `;` separator", () => {
		const path = writeTmp("simple.csv", "A;B;C\n1;2;3\n4;5;6\n");
		tmpFiles.push(path);

		const rows = parseCsv(path);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual({ A: "1", B: "2", C: "3" });
		expect(rows[1]).toEqual({ A: "4", B: "5", C: "6" });
	});

	it("returns an empty array if the file has only one line (header only)", () => {
		const path = writeTmp("header-only.csv", "A;B;C\n");
		tmpFiles.push(path);

		expect(parseCsv(path)).toHaveLength(0);
	});

	it("returns an empty array if the file is empty", () => {
		const path = writeTmp("empty.csv", "");
		tmpFiles.push(path);

		expect(parseCsv(path)).toHaveLength(0);
	});

	it("handles Windows line endings (CRLF)", () => {
		const path = writeTmp("crlf.csv", "X;Y\r\nhello;world\r\n");
		tmpFiles.push(path);

		const rows = parseCsv(path);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toEqual({ X: "hello", Y: "world" });
	});

	it("handles quoted fields containing `;`", () => {
		const path = writeTmp(
			"quoted.csv",
			'Nom;Adresse\nDupont;"3, rue de la Paix;75001"\n',
		);
		tmpFiles.push(path);

		const rows = parseCsv(path);
		expect(rows[0]!.Adresse).toBe("3, rue de la Paix;75001");
	});

	it("decodes latin-1 characters (accents)", () => {
		// "Opérateur" in latin-1: é = 0xe9
		const content = Buffer.from("Op\xe9rateur;Code\nOrange;FRTE\n", "latin1");
		const path = join(tmpdir(), "latin1.csv");
		writeFileSync(path, content);
		tmpFiles.push(path);

		const rows = parseCsv(path);
		expect(rows[0]!.Opérateur).toBe("Orange");
	});

	it("trims spaces around keys and values", () => {
		const path = writeTmp("spaces.csv", " A ; B \n val1 ; val2 \n");
		tmpFiles.push(path);

		const rows = parseCsv(path);
		expect(rows[0]).toHaveProperty("A");
		expect(rows[0]!.A).toBe("val1");
	});

	it("handles missing fields at end of line", () => {
		const path = writeTmp("missing.csv", "A;B;C\n1;2\n");
		tmpFiles.push(path);

		const rows = parseCsv(path);
		expect(rows[0]!.C).toBe("");
	});
});
