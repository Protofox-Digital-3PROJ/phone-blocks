/**
 * @module phone-blocks
 * @description
 * French phone number block resolution library.
 *
 * Uses ARCEP open data files published on data.gouv.fr:
 * - **MAJNUM**: number ranges and their assignee
 * - **MAJRIO**: full identity of each assignee
 *
 * ### Quick usage
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

export { parseCsv } from "./csv-parser.js";
export { PhoneBlockRegistry } from "./PhoneBlockRegistry.js";
export type {
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
	Territoire,
} from "./types.js";
