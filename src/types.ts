/**
 * @module types
 * @description Type definitions for ARCEP data (data.gouv.fr).
 *
 * MAJNUM: table of assigned number ranges.
 * MAJRIO: table of assignees (operators / resources).
 */

/**
 * Geographic territory associated with a number block.
 */
export type Territoire = "Métropole" | "DOM" | "COM" | string;

/**
 * Represents a raw row from the MAJNUM.csv file,
 * as returned by the parser.
 */
export interface RawNumBlock {
	/** Numeric block identifier (EZABPQM column). */
	EZABPQM: number;
	/** First number in the range (inclusive). */
	Tranche_Debut: number;
	/** Last number in the range (inclusive). */
	Tranche_Fin: number;
	/** 4-letter mnemonic code of the assignee. */
	Mnémo: string;
	/** Territory assigned to the block. */
	Territoire: Territoire;
	/** Assignment date in DD/MM/YYYY format. */
	Date_Attribution: string;
}

/**
 * Represents a raw row from the MAJRIO.csv file,
 * as returned by the parser.
 */
export interface RawOperator {
	/** Short resource code (e.g. "F0", "SFR0"). */
	Ressource: string;
	/** 4-letter assignee code (e.g. "FRTE", "SFR0"). */
	"Code Attributaire": string;
	/** Full operator name. */
	Attributaire: string;
	/** Assignment effective date in DD/MM/YYYY format. */
	"Date d'effet (attribution)": string;
	/** ARCEP decision number. */
	"N° décision d'attribution": string;
}

/**
 * Enriched phone number block: range + resolved operator.
 */
export interface PhoneBlock {
	/** EZABPQM block identifier. */
	readonly id: number;
	/** First number in the range (inclusive). */
	readonly rangeStart: number;
	/** Last number in the range (inclusive). */
	readonly rangeEnd: number;
	/** Assignee mnemonic code (e.g. "FRTE"). */
	readonly operatorCode: string;
	/** Human-readable operator name, if available in MAJRIO. */
	readonly operatorName: string | null;
	/** Assigned territory. */
	readonly territoire: Territoire;
	/** Assignment date (Date object). */
	readonly attributedAt: Date;
}

/**
 * Result of a phone number lookup.
 */
export interface LookupResult {
	/** Queried number, normalized to 9 digits (without the leading 0). */
	readonly normalizedNumber: string;
	/** Found block, or `null` if the number does not belong to any range. */
	readonly block: PhoneBlock | null;
}
