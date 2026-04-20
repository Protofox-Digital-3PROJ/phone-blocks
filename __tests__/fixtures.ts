/**
 * @file fixtures.ts
 * @description Synthetic test data representing a realistic subset
 * of ARCEP's MAJNUM and MAJRIO files.
 */

import type { RawNumBlock, RawOperator } from "../src/types";

/** Fictional operators covering nominal and edge cases. */
export const OPERATORS: RawOperator[] = [
	{
		Ressource: "F0",
		"Code Attributaire": "FRTE",
		Attributaire: "Orange",
		"Date d'effet (attribution)": "01/01/2017",
		"N° décision d'attribution": "2016-1702",
	},
	{
		Ressource: "F1",
		"Code Attributaire": "SFR0",
		Attributaire: "Société française du radiotéléphone",
		"Date d'effet (attribution)": "26/03/2015",
		"N° décision d'attribution": "2015-0347",
	},
	{
		Ressource: "F2",
		"Code Attributaire": "BYGT",
		Attributaire: "Bouygues Telecom",
		"Date d'effet (attribution)": "01/01/2010",
		"N° décision d'attribution": "2009-1234",
	},
];

/**
 * Synthetic number blocks.
 *
 * Ranges:
 * - 600000000 → 609999999  (FRTE / Orange)
 * - 610000000 → 619999999  (SFR0)
 * - 700000000 → 709999999  (BYGT / Bouygues)
 * - 800000000 → 800000000  (UNKN → operator absent from MAJRIO)
 */
export const NUM_BLOCKS: RawNumBlock[] = [
	{
		EZABPQM: 6000,
		Tranche_Debut: 600000000,
		Tranche_Fin: 609999999,
		Mnémo: "FRTE",
		Territoire: "Métropole",
		Date_Attribution: "01/01/2017",
	},
	{
		EZABPQM: 6100,
		Tranche_Debut: 610000000,
		Tranche_Fin: 619999999,
		Mnémo: "SFR0",
		Territoire: "Métropole",
		Date_Attribution: "26/03/2015",
	},
	{
		EZABPQM: 7000,
		Tranche_Debut: 700000000,
		Tranche_Fin: 709999999,
		Mnémo: "BYGT",
		Territoire: "DOM",
		Date_Attribution: "01/01/2010",
	},
	{
		EZABPQM: 8000,
		Tranche_Debut: 800000000,
		Tranche_Fin: 800000000,
		Mnémo: "UNKN",
		Territoire: "COM",
		Date_Attribution: "01/06/2020",
	},
];
