/**
 * @file PhoneBlockRegistry.test.ts
 * @description Tests unitaires de la classe PhoneBlockRegistry.
 *
 * Couvre :
 * - La factory `fromRaw` (données synthétiques)
 * - La factory `fromFiles` (fichiers réels data.gouv.fr)
 * - La normalisation des numéros de téléphone
 * - La recherche dichotomique (`lookup`)
 * - Les requêtes par opérateur (`getBlocksByOperator`)
 * - Le listing d'opérateurs (`getOperators`)
 * - Les statistiques (`getStats`)
 * - Les cas limites et valeurs invalides
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { NUM_BLOCKS, OPERATORS } from "./fixtures.js";
import { PhoneBlockRegistry } from "./src/PhoneBlockRegistry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");

// ─── Registre construit depuis les fixtures ───────────────────────────────────

describe("PhoneBlockRegistry — fromRaw (fixtures synthétiques)", () => {
  const registry = PhoneBlockRegistry.fromRaw(NUM_BLOCKS, OPERATORS);

  // ── Construction ────────────────────────────────────────────────────────────

  describe("construction", () => {
    it("charge le bon nombre de blocs", () => {
      expect(registry.size).toBe(4);
    });

    it("résout les noms d'opérateurs depuis MAJRIO", () => {
      const { block } = registry.lookup("0600000000");
      expect(block?.operatorName).toBe("Orange");
    });

    it("expose `null` pour un code opérateur absent de MAJRIO", () => {
      const { block } = registry.lookup("0800000000");
      expect(block?.operatorCode).toBe("UNKN");
      expect(block?.operatorName).toBeNull();
    });
  });

  // ── Normalisation des numéros ────────────────────────────────────────────────

  describe("lookup — normalisation des formats", () => {
    const cases: Array<[string, string | null]> = [
      ["0612345678",        "612345678"],   // format standard
      ["+33612345678",      "612345678"],   // E.164 sans espace
      ["+33 6 12 34 56 78", "612345678"],   // E.164 avec espaces
      ["06-12-34-56-78",    "612345678"],   // tirets
      ["06.12.34.56.78",    "612345678"],   // points
      ["6 12 34 56 78",     "612345678"],   // 9 chiffres avec espaces
    ];

    it.each(cases)(
      "normalise « %s » → %s",
      (input, expected) => {
        const result = registry.lookup(input);
        expect(result.normalizedNumber).toBe(expected ?? input);
      }
    );
  });

  // ── Recherches valides ───────────────────────────────────────────────────────

  describe("lookup — numéros dans les tranches", () => {
    it("trouve le premier numéro d'une tranche (borne basse)", () => {
      const { block } = registry.lookup("0600000000");
      expect(block).not.toBeNull();
      expect(block!.operatorCode).toBe("FRTE");
    });

    it("trouve le dernier numéro d'une tranche (borne haute)", () => {
      const { block } = registry.lookup("0609999999");
      expect(block?.operatorCode).toBe("FRTE");
    });

    it("trouve un numéro au milieu d'une tranche", () => {
      const { block } = registry.lookup("0615000000");
      expect(block?.operatorCode).toBe("SFR0");
      expect(block?.operatorName).toBe("Société française du radiotéléphone");
    });

    it("trouve un numéro dans une tranche DOM", () => {
      const { block } = registry.lookup("0700000001");
      expect(block?.operatorCode).toBe("BYGT");
      expect(block?.territoire).toBe("DOM");
    });

    it("retourne le bon territoire", () => {
      const { block } = registry.lookup("0700000000");
      expect(block?.territoire).toBe("DOM");
    });

    it("retourne une date d'attribution valide", () => {
      const { block } = registry.lookup("0600000000");
      expect(block?.attributedAt).toBeInstanceOf(Date);
      expect(block?.attributedAt.getFullYear()).toBe(2017);
    });
  });

  // ── Numéros hors tranche ─────────────────────────────────────────────────────

  describe("lookup — numéros hors des tranches", () => {
    it("retourne null pour un numéro entre deux tranches", () => {
      const { block } = registry.lookup("0650000000");
      expect(block).toBeNull();
    });

    it("retourne null pour un numéro avant toutes les tranches", () => {
      const { block } = registry.lookup("0100000000");
      expect(block).toBeNull();
    });

    it("retourne null pour un numéro après toutes les tranches", () => {
      const { block } = registry.lookup("0999999999");
      expect(block).toBeNull();
    });
  });

  // ── Entrées invalides ────────────────────────────────────────────────────────

  describe("lookup — entrées invalides", () => {
    it("retourne block=null pour une chaîne vide", () => {
      expect(registry.lookup("").block).toBeNull();
    });

    it("retourne block=null pour un numéro trop court", () => {
      expect(registry.lookup("0612").block).toBeNull();
    });

    it("retourne block=null pour un numéro trop long", () => {
      expect(registry.lookup("06123456789").block).toBeNull();
    });

    it("retourne block=null pour des caractères non numériques", () => {
      expect(registry.lookup("abcdefghij").block).toBeNull();
    });

    it("conserve l'input original dans normalizedNumber quand le format est invalide", () => {
      const result = registry.lookup("INVALID");
      expect(result.normalizedNumber).toBe("INVALID");
    });
  });

  // ── getBlocksByOperator ──────────────────────────────────────────────────────

  describe("getBlocksByOperator", () => {
    it("retourne les blocs d'un opérateur connu", () => {
      const blocks = registry.getBlocksByOperator("FRTE");
      expect(blocks).toHaveLength(1);
      expect(blocks[0].rangeStart).toBe(600000000);
    });

    it("est insensible à la casse", () => {
      const lower = registry.getBlocksByOperator("frte");
      const upper = registry.getBlocksByOperator("FRTE");
      expect(lower).toHaveLength(upper.length);
    });

    it("retourne un tableau vide pour un code inconnu", () => {
      expect(registry.getBlocksByOperator("XXXX")).toHaveLength(0);
    });
  });

  // ── getOperators ─────────────────────────────────────────────────────────────

  describe("getOperators", () => {
    it("retourne tous les opérateurs de MAJRIO", () => {
      const ops = registry.getOperators();
      expect(ops).toHaveLength(OPERATORS.length);
    });

    it("est trié par code alphabétique", () => {
      const ops = registry.getOperators();
      const codes = ops.map((o) => o.code);
      expect(codes).toEqual([...codes].sort());
    });

    it("chaque entrée possède code et name", () => {
      for (const op of registry.getOperators()) {
        expect(op.code).toBeTruthy();
        expect(op.name).toBeTruthy();
      }
    });
  });

  // ── getStats ─────────────────────────────────────────────────────────────────

  describe("getStats", () => {
    it("compte le bon nombre de blocs", () => {
      expect(registry.getStats().totalBlocks).toBe(4);
    });

    it("compte le bon nombre d'opérateurs", () => {
      expect(registry.getStats().totalOperators).toBe(OPERATORS.length);
    });

    it("calcule correctement le total de numéros", () => {
      // (609999999-600000000+1) + (619999999-610000000+1)
      // + (709999999-700000000+1) + (800000000-800000000+1)
      const expected = 10_000_000 + 10_000_000 + 10_000_000 + 1;
      expect(registry.getStats().totalNumbers).toBe(expected);
    });

    it("compte les blocs sans opérateur connu", () => {
      // UNKN n'est pas dans MAJRIO → 1 bloc sans opérateur
      expect(registry.getStats().blocksWithUnknownOperator).toBe(1);
    });
  });
});

// ─── Registre construit depuis les vrais fichiers ─────────────────────────────

describe("PhoneBlockRegistry — fromFiles (données réelles ARCEP)", () => {
  let registry: PhoneBlockRegistry;

  beforeAll(() => {
    registry = PhoneBlockRegistry.fromFiles(
      join(DATA_DIR, "MAJNUM.csv"),
      join(DATA_DIR, "MAJRIO.csv")
    );
  });

  it("charge plus de 10 000 blocs", () => {
    expect(registry.size).toBeGreaterThan(10_000);
  });

  it("résout l'opérateur sur un numéro mobile 06 connu", () => {
    const { block } = registry.lookup("0612345678");
    expect(block).not.toBeNull();
    expect(block!.operatorName).toBeTruthy();
  });

  it("résout Bouygues Telecom sur un numéro 07 connu", () => {
    const { block } = registry.lookup("0750000000");
    expect(block).not.toBeNull();
    expect(block!.operatorName).toBe("Bouygues Telecom");
  });

  it("résout Orange sur le numéro 0800000000 (services spéciaux)", () => {
    const { block } = registry.lookup("0800000000");
    expect(block).not.toBeNull();
    expect(block!.operatorName).toBe("Orange");
  });

  it("retourne null pour un numéro impossible", () => {
    expect(registry.lookup("0000000000").block).toBeNull();
  });

  it("couvre plus de 400 millions de numéros", () => {
    expect(registry.getStats().totalNumbers).toBeGreaterThan(400_000_000);
  });

  it("recense au moins 100 opérateurs distincts", () => {
    expect(registry.getOperators().length).toBeGreaterThan(100);
  });
});
