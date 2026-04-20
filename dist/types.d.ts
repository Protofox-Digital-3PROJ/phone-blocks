/**
 * @module types
 * @description Définitions de types pour les données de l'ARCEP (data.gouv.fr).
 *
 * MAJNUM : table des tranches de numéros attribuées.
 * MAJRIO : table des attributaires (opérateurs / ressources).
 */
/**
 * Territoire géographique associé à un bloc de numéros.
 */
export type Territoire = "Métropole" | "DOM" | "COM" | string;
/**
 * Représente une ligne brute du fichier MAJNUM.csv,
 * telle qu'elle arrive après parsing.
 */
export interface RawNumBlock {
    /** Identifiant numérique du bloc (colonne EZABPQM). */
    EZABPQM: number;
    /** Premier numéro de la tranche (inclus). */
    Tranche_Debut: number;
    /** Dernier numéro de la tranche (inclus). */
    Tranche_Fin: number;
    /** Code mnémonique à 4 lettres de l'attributaire. */
    "Mnémo": string;
    /** Territoire d'affectation du bloc. */
    Territoire: Territoire;
    /** Date d'attribution au format JJ/MM/AAAA. */
    Date_Attribution: string;
}
/**
 * Représente une ligne brute du fichier MAJRIO.csv,
 * telle qu'elle arrive après parsing.
 */
export interface RawOperator {
    /** Code ressource court (ex : "F0", "SFR0"). */
    Ressource: string;
    /** Code attributaire à 4 lettres (ex : "FRTE", "SFR0"). */
    "Code Attributaire": string;
    /** Nom complet de l'opérateur. */
    Attributaire: string;
    /** Date d'effet de l'attribution au format JJ/MM/AAAA. */
    "Date d'effet (attribution)": string;
    /** Numéro de la décision ARCEP. */
    "N° décision d'attribution": string;
}
/**
 * Bloc de numéros enrichi : tranche + opérateur résolu.
 */
export interface PhoneBlock {
    /** Identifiant EZABPQM du bloc. */
    readonly id: number;
    /** Premier numéro de la tranche (inclus). */
    readonly rangeStart: number;
    /** Dernier numéro de la tranche (inclus). */
    readonly rangeEnd: number;
    /** Code mnémonique de l'attributaire (ex : "FRTE"). */
    readonly operatorCode: string;
    /** Nom lisible de l'opérateur, si disponible dans MAJRIO. */
    readonly operatorName: string | null;
    /** Territoire d'affectation. */
    readonly territoire: Territoire;
    /** Date d'attribution (objet Date). */
    readonly attributedAt: Date;
}
/**
 * Résultat d'une recherche par numéro.
 */
export interface LookupResult {
    /** Numéro interrogé, normalisé sur 9 chiffres (sans le 0 initial). */
    readonly normalizedNumber: string;
    /** Bloc trouvé, ou `null` si le numéro n'appartient à aucune tranche. */
    readonly block: PhoneBlock | null;
}
//# sourceMappingURL=types.d.ts.map