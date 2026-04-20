/**
 * @module types
 * @description Type definitions for ARCEP data (data.gouv.fr).
 *
 * MAJNUM: table of assigned number ranges.
 * MAJRIO: table of assignees (operators / resources).
 * MAJNFB: table of short/special numbers (emergency, services).
 * MAJMNC: table of Mobile Network Codes (MCC-MNC).
 * MAJPORTA: table of number portability assignments.
 * MAJCPSN/MAJCPSI/MAJR1R2/MAJSDT: additional operator tables.
 * GELNUM: table of frozen number blocks open for attribution.
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

/**
 * Represents a raw row from the MAJMNC.csv file (Mobile Network Codes).
 */
export interface RawMobileNetworkCode {
	/** MCC-MNC identifier (e.g. "20801"). */
	"MCC-MNC": string;
	/** 4-letter mnemonic code of the assignee. */
	Mnémo: string;
	/** Full operator name. */
	Nom: string;
	/** Assignment date in DD/MM/YYYY format. */
	Date_Attribution: string;
	/** ARCEP decision number. */
	Décision_Attribution: string;
}

/**
 * Enriched Mobile Network Code entry.
 */
export interface MobileNetworkCode {
	/** MCC-MNC identifier (e.g. "20801"). */
	readonly mccMnc: string;
	/** Assignee mnemonic code (e.g. "FRTE"). */
	readonly operatorCode: string;
	/** Full operator name. */
	readonly operatorName: string;
	/** Assignment date (Date object). */
	readonly attributedAt: Date;
	/** ARCEP decision number. */
	readonly decision: string;
}

/**
 * Represents a raw row from the MAJPORTA.csv file (number portability).
 */
export interface RawPortability {
	/** Block identifier (EZABPQM column). */
	EZABPQM: string;
	/** 4-letter mnemonic code of the current assignee. */
	Mnémo: string;
	/** Assignment date in DD/MM/YYYY format. */
	Date_Attribution: string;
}

/**
 * Enriched portability entry: block reassigned after number portability.
 */
export interface PortabilityEntry {
	/** Block identifier (EZABPQM). */
	readonly blockId: string;
	/** Current assignee mnemonic code. */
	readonly operatorCode: string;
	/** Human-readable operator name, if available. */
	readonly operatorName: string | null;
	/** Assignment date (Date object). */
	readonly attributedAt: Date;
}

/**
 * Result of a short/special number lookup.
 */
export interface ShortNumberLookupResult {
	/** Queried short number (as-is). */
	readonly number: string;
	/** Found block, or `null` if the number is not a known short number. */
	readonly block: PhoneBlock | null;
}

/**
 * Represents a raw row from the GELNUM.csv file (frozen number blocks).
 */
export interface RawFrozenBlock {
	/** Block identifier (EZABPQM). */
	EZABPQM: string;
	/** Type of number resource. */
	Type: string;
	/** Opening date for expressions of interest (DD/MM/YYYY). */
	"Ouverture des manifestations d'intérêts": string;
	/** Closing date for expressions of interest (DD/MM/YYYY). */
	"Clôture des manifestations d'intérêts": string;
	/** Opening date for attribution requests (DD/MM/YYYY). */
	"Ouverture des demandes d'attribution": string;
}

/**
 * Enriched frozen block entry.
 */
export interface FrozenBlock {
	/** Block identifier (EZABPQM). */
	readonly blockId: string;
	/** Type of number resource (e.g. "Numéros polyvalents"). */
	readonly type: string;
	/** Opening date for expressions of interest. */
	readonly interestOpensAt: Date;
	/** Closing date for expressions of interest. */
	readonly interestClosesAt: Date;
	/** Opening date for attribution requests. */
	readonly attributionOpensAt: Date;
}
