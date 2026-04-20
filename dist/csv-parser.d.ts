/**
 * @module csv-parser
 * @description Utilitaire léger de parsing CSV/latin-1 sans dépendance externe.
 *
 * Gère le séparateur `;`, l'encodage latin-1 (ISO-8859-1) utilisé par l'ARCEP,
 * et les lignes avec des champs vides.
 */
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
export declare function parseCsv(filePath: string): Record<string, string>[];
//# sourceMappingURL=csv-parser.d.ts.map