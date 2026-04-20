/**
 * @file csv-parser.test.ts
 * @description Tests unitaires du parser CSV.
 */

import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseCsv } from "./dist/csv-parser.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Écrit un fichier temporaire et retourne son chemin. */
function writeTmp(name: string, content: string): string {
  const path = join(tmpdir(), name);
  writeFileSync(path, Buffer.from(content, "latin1"));
  return path;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("parseCsv", () => {
  let tmpFiles: string[] = [];

  afterAll(() => {
    for (const f of tmpFiles) {
      try { unlinkSync(f); } catch { /* ignore */ }
    }
  });

  it("parse un CSV simple avec séparateur `;`", () => {
    const path = writeTmp("simple.csv", "A;B;C\n1;2;3\n4;5;6\n");
    tmpFiles.push(path);

    const rows = parseCsv(path);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ A: "1", B: "2", C: "3" });
    expect(rows[1]).toEqual({ A: "4", B: "5", C: "6" });
  });

  it("retourne un tableau vide si le fichier n'a qu'une ligne (en-tête seul)", () => {
    const path = writeTmp("header-only.csv", "A;B;C\n");
    tmpFiles.push(path);

    expect(parseCsv(path)).toHaveLength(0);
  });

  it("retourne un tableau vide si le fichier est vide", () => {
    const path = writeTmp("empty.csv", "");
    tmpFiles.push(path);

    expect(parseCsv(path)).toHaveLength(0);
  });

  it("gère les fins de ligne Windows (CRLF)", () => {
    const path = writeTmp("crlf.csv", "X;Y\r\nhello;world\r\n");
    tmpFiles.push(path);

    const rows = parseCsv(path);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ X: "hello", Y: "world" });
  });

  it("gère les champs entre guillemets contenant un `;`", () => {
    const path = writeTmp("quoted.csv", 'Nom;Adresse\nDupont;"3, rue de la Paix;75001"\n');
    tmpFiles.push(path);

    const rows = parseCsv(path);
    expect(rows[0]["Adresse"]).toBe("3, rue de la Paix;75001");
  });

  it("décode les caractères latin-1 (accents)", () => {
    // "Opérateur" en latin-1 : é = 0xe9
    const content = Buffer.from("Op\xe9rateur;Code\nOrange;FRTE\n", "latin1");
    const path = join(tmpdir(), "latin1.csv");
    writeFileSync(path, content);
    tmpFiles.push(path);

    const rows = parseCsv(path);
    expect(rows[0]["Opérateur"]).toBe("Orange");
  });

  it("supprime les espaces autour des clés et valeurs", () => {
    const path = writeTmp("spaces.csv", " A ; B \n val1 ; val2 \n");
    tmpFiles.push(path);

    const rows = parseCsv(path);
    expect(rows[0]).toHaveProperty("A");
    expect(rows[0]["A"]).toBe("val1");
  });

  it("gère les champs manquants en fin de ligne", () => {
    const path = writeTmp("missing.csv", "A;B;C\n1;2\n");
    tmpFiles.push(path);

    const rows = parseCsv(path);
    expect(rows[0]["C"]).toBe("");
  });
});
