/**
 * @module csv-parser
 * @description Utilitaire léger de parsing CSV/latin-1 sans dépendance externe.
 *
 * Gère le séparateur `;`, l'encodage latin-1 (ISO-8859-1) utilisé par l'ARCEP,
 * et les lignes avec des champs vides.
 */

import { readFileSync } from "node:fs";

/**
 * Parse un fichier CSV encodé en latin-1 avec séparateur `;`.
 *
 * @param filePath - Chemin absolu ou relatif vers le fichier `.csv`.
 * @returns Tableau d'objets dont les clés sont les en-têtes de la première ligne.
 *
 * @example
 * ```ts
 * const rows = parseCsv("/data/MAJNUM.csv");
 * console.log(rows[0]); // { EZABPQM: "1056", Tranche_Debut: "105600000", ... }
 * ```
 */
export function parseCsv(filePath: string): Record<string, string>[] {
	const buffer = readFileSync(filePath);

	// Décodage latin-1 (ISO-8859-1) : chaque octet → caractère Unicode 1:1
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
 * Décode un `Buffer` encodé en ISO-8859-1 (latin-1) en chaîne Unicode.
 *
 * @param buf - Buffer brut lu depuis le disque.
 * @returns Chaîne de caractères décodée.
 */
function decodeLatin1(buf: Buffer): string {
	let result = "";
	for (let i = 0; i < buf.length; i++) {
		result += String.fromCharCode(buf[i]!);
	}
	return result;
}

/**
 * Découpe une ligne CSV sur le séparateur `;`.
 * Gère les champs entre guillemets doubles (`"`).
 *
 * @param line - Ligne brute du fichier.
 * @returns Tableau de valeurs (sans les guillemets).
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
