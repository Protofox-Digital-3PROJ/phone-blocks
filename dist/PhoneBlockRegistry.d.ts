/**
 * @module PhoneBlockRegistry
 * @description Registre principal des blocs de numéros téléphoniques français.
 *
 * Charge et indexe les fichiers MAJNUM et MAJRIO publiés par l'ARCEP sur
 * data.gouv.fr, puis expose des méthodes de recherche efficaces.
 *
 * @example
 * ```ts
 * import { PhoneBlockRegistry } from "./PhoneBlockRegistry.js";
 *
 * const registry = PhoneBlockRegistry.fromFiles(
 *   "./data/MAJNUM.csv",
 *   "./data/MAJRIO.csv"
 * );
 *
 * const result = registry.lookup("0612345678");
 * console.log(result.block?.operatorName); // "Orange"
 * ```
 */
import type { LookupResult, PhoneBlock, RawNumBlock, RawOperator } from "./types.js";
/**
 * Registre des blocs de numérotation téléphonique français.
 *
 * Encapsule les données MAJNUM (tranches) et MAJRIO (opérateurs) et fournit :
 * - une recherche par numéro (`lookup`)
 * - un listing des opérateurs (`getOperators`)
 * - des statistiques agrégées (`getStats`)
 */
export declare class PhoneBlockRegistry {
    /** Blocs indexés, triés par `rangeStart` pour la recherche binaire. */
    private readonly blocks;
    /** Index opérateurs : code mnémo → nom complet. */
    private readonly operatorIndex;
    /**
     * Constructeur privé — utilisez {@link PhoneBlockRegistry.fromFiles} ou
     * {@link PhoneBlockRegistry.fromRaw} pour instancier.
     *
     * @param blocks - Blocs déjà construits et triés.
     * @param operatorIndex - Map code → nom d'opérateur.
     */
    private constructor();
    /**
     * Construit un registre en lisant directement les fichiers CSV de l'ARCEP.
     *
     * @param majnumPath - Chemin vers `MAJNUM.csv`.
     * @param majrioPath - Chemin vers `MAJRIO.csv`.
     * @returns Instance de {@link PhoneBlockRegistry} prête à l'emploi.
     *
     * @throws {Error} Si l'un des fichiers est illisible ou mal formé.
     *
     * @example
     * ```ts
     * const registry = PhoneBlockRegistry.fromFiles(
     *   "./data/MAJNUM.csv",
     *   "./data/MAJRIO.csv"
     * );
     * ```
     */
    static fromFiles(majnumPath: string, majrioPath: string): PhoneBlockRegistry;
    /**
     * Construit un registre depuis des données déjà parsées (utile pour les tests
     * ou les environnements sans accès filesystem).
     *
     * @param rawBlocks - Lignes brutes de MAJNUM.
     * @param rawOperators - Lignes brutes de MAJRIO.
     * @returns Instance de {@link PhoneBlockRegistry}.
     */
    static fromRaw(rawBlocks: RawNumBlock[], rawOperators: RawOperator[]): PhoneBlockRegistry;
    /**
     * Recherche le bloc de numérotation auquel appartient un numéro de téléphone.
     *
     * La recherche est effectuée par **dichotomie** (O(log n)) sur les tranches
     * triées par `rangeStart`.
     *
     * @param phoneNumber - Numéro à rechercher (formats acceptés :
     *   `"0612345678"`, `"+33612345678"`, `"6 12 34 56 78"`).
     * @returns {@link LookupResult} avec le bloc trouvé ou `null`.
     *
     * @example
     * ```ts
     * const { block } = registry.lookup("0612345678");
     * if (block) {
     *   console.log(`Opérateur : ${block.operatorName}`);
     * }
     * ```
     */
    lookup(phoneNumber: string): LookupResult;
    /**
     * Retourne tous les blocs appartenant à un opérateur donné.
     *
     * @param operatorCode - Code mnémonique (ex : `"FRTE"`, `"SFR0"`).
     * @returns Tableau de {@link PhoneBlock} (peut être vide).
     */
    getBlocksByOperator(operatorCode: string): PhoneBlock[];
    /**
     * Liste tous les opérateurs présents dans MAJRIO.
     *
     * @returns Tableau de paires `{ code, name }` triées par code.
     */
    getOperators(): Array<{
        code: string;
        name: string;
    }>;
    /**
     * Retourne des statistiques globales sur le registre chargé.
     *
     * @returns Objet de statistiques.
     *
     * @example
     * ```ts
     * const stats = registry.getStats();
     * console.log(`${stats.totalBlocks} blocs, ${stats.totalOperators} opérateurs`);
     * ```
     */
    getStats(): {
        totalBlocks: number;
        totalOperators: number;
        totalNumbers: number;
        blocksWithUnknownOperator: number;
    };
    /**
     * Nombre total de blocs chargés.
     */
    get size(): number;
    /**
     * Recherche dichotomique d'un numéro dans les tranches triées.
     *
     * @param value - Valeur numérique du numéro (9 chiffres sans le `0`).
     * @returns Le {@link PhoneBlock} correspondant, ou `null`.
     */
    private binarySearch;
}
//# sourceMappingURL=PhoneBlockRegistry.d.ts.map