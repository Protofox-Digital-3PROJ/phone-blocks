/**
 * @module csv-parser
 * @description Lightweight CSV/latin-1 parser with no external dependencies.
 *
 * Handles the `;` separator, latin-1 (ISO-8859-1) encoding used by ARCEP,
 * and lines with empty fields.
 */

import { readFileSync } from "node:fs";

/**
 * Parses a latin-1 encoded CSV file with `;` separator.
 *
 * @param filePath - Absolute or relative path to the `.csv` file.
 * @returns Array of objects whose keys are the headers from the first line.
 *
 * @example
 * ```ts
 * const rows = parseCsv("/data/MAJNUM.csv");
 * console.log(rows[0]); // { EZABPQM: "1056", Tranche_Debut: "105600000", ... }
 * ```
 */
export function parseCsv(filePath: string): Record<string, string>[] {
	const buffer = readFileSync(filePath);

	// Latin-1 (ISO-8859-1) decoding: each byte maps 1:1 to a Unicode character
	const text = decodeLatin1(buffer);

	const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (lines.length < 2) return [];

	const headers = splitLine(lines[0]!);
	const rows: Record<string, string>[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = splitLine(lines[i]!);
		const row: Record<string, string> = {};
		headers.forEach((header, idx) => {
			row[header.trim()] = (values[idx] ?? "").trim();
		});
		rows.push(row);
	}

	return rows;
}

/**
 * Decodes an ISO-8859-1 (latin-1) encoded `Buffer` into a Unicode string.
 *
 * @param buf - Raw buffer read from disk.
 * @returns Decoded string.
 */
function decodeLatin1(buf: Buffer): string {
	let result = "";
	for (let i = 0; i < buf.length; i++) {
		result += String.fromCharCode(buf[i]!);
	}
	return result;
}

/**
 * Splits a CSV line on the `;` separator.
 * Handles double-quoted fields (`"`).
 *
 * @param line - Raw line from the file.
 * @returns Array of values (without quotes).
 */
function splitLine(line: string): string[] {
	const fields: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
		} else if (ch === ";" && !inQuotes) {
			fields.push(current);
			current = "";
		} else {
			current += ch;
		}
	}
	fields.push(current);
	return fields;
}
