/**
 * @module phone-blocks
 * @description
 * Librairie de résolution de blocs de numérotation téléphonique français.
 *
 * Utilise les fichiers ouverts de l'ARCEP publiés sur data.gouv.fr :
 * - **MAJNUM** : tranches de numéros et leur attributaire
 * - **MAJRIO** : identité complète de chaque attributaire
 *
 * ### Usage rapide
 *
 * ```ts
 * import { PhoneBlockRegistry } from "phone-blocks";
 *
 * const registry = PhoneBlockRegistry.fromFiles(
 *   "./data/MAJNUM.csv",
 *   "./data/MAJRIO.csv"
 * );
 *
 * const { block } = registry.lookup("0612345678");
 * console.log(block?.operatorName); // "Orange"
 * ```
 *
 * @packageDocumentation
 */
export { PhoneBlockRegistry } from "./PhoneBlockRegistry.js";
export { parseCsv } from "./csv-parser.js";
