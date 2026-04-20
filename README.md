# phone-blocks

French phone number block resolution library powered by [ARCEP open data](https://data.gouv.fr) (the French telecom regulator).

Look up any French phone number to find its assigned operator, territory, and attribution date — using official government datasets.

## Installation

```bash
npm install phone-blocks
# or
bun add phone-blocks
```

## Quick start

```ts
import { PhoneBlockRegistry } from "phone-blocks";

const registry = PhoneBlockRegistry.fromFiles(
  "./data/MAJNUM.csv",
  "./data/MAJRIO.csv",
);

const { block } = registry.lookup("0612345678");
console.log(block?.operatorName); // "Orange"
```

## Supported datasets

The library supports all ARCEP CSV datasets published on data.gouv.fr:

| File | Description | Required |
|---|---|---|
| `MAJNUM.csv` | Number block ranges and their assignees | **Yes** |
| `MAJRIO.csv` | Operator identity table | **Yes** |
| `MAJNFB.csv` | Short/special numbers (emergency, services) | No |
| `MAJMNC.csv` | Mobile Network Codes (MCC-MNC) | No |
| `MAJPORTA.csv` | Number portability reassignments | No |
| `MAJCPSN.csv` | Additional operator table (CPSN) | No |
| `MAJCPSI.csv` | Additional operator table (CPSI) | No |
| `MAJR1R2.csv` | Additional operator table (R1/R2) | No |
| `MAJSDT.csv` | Additional operator table (SDT) | No |
| `GELNUM.csv` | Frozen number blocks open for attribution | No |

## Loading all datasets

```ts
const registry = PhoneBlockRegistry.fromFiles(
  "./data/MAJNUM.csv",
  "./data/MAJRIO.csv",
  {
    majnfbPath: "./data/MAJNFB.csv",
    majmncPath: "./data/MAJMNC.csv",
    majportaPath: "./data/MAJPORTA.csv",
    gelnumPath: "./data/GELNUM.csv",
    extraOperatorPaths: [
      "./data/MAJCPSN.csv",
      "./data/MAJCPSI.csv",
      "./data/MAJR1R2.csv",
      "./data/MAJSDT.csv",
    ],
  },
);
```

## API reference

### `PhoneBlockRegistry`

#### Static factories

##### `fromFiles(majnumPath, majrioPath, options?)`

Creates a registry by reading CSV files from disk. Files are parsed as Latin-1 (ISO-8859-1) with `;` as separator.

```ts
const registry = PhoneBlockRegistry.fromFiles("./data/MAJNUM.csv", "./data/MAJRIO.csv");
```

**Options:**

| Property | Type | Description |
|---|---|---|
| `majnfbPath` | `string` | Path to `MAJNFB.csv` (short numbers) |
| `majmncPath` | `string` | Path to `MAJMNC.csv` (MCC-MNC) |
| `majportaPath` | `string` | Path to `MAJPORTA.csv` (portability) |
| `gelnumPath` | `string` | Path to `GELNUM.csv` (frozen blocks) |
| `extraOperatorPaths` | `string[]` | Paths to extra operator tables (MAJCPSN, MAJCPSI, MAJR1R2, MAJSDT) |

##### `fromRaw(rawBlocks, rawOperators, options?)`

Creates a registry from pre-parsed data arrays. Useful for tests or environments without filesystem access.

```ts
const registry = PhoneBlockRegistry.fromRaw(rawBlocks, rawOperators, {
  rawShortNumbers: [...],
  rawMnc: [...],
  rawPortability: [...],
  rawFrozen: [...],
  extraOperators: [...],
});
```

#### Phone number lookup

##### `lookup(phoneNumber): LookupResult`

Finds the number block a phone number belongs to, using binary search (O(log n)).

Accepted formats: `"0612345678"`, `"+33612345678"`, `"+33 6 12 34 56 78"`, `"06-12-34-56-78"`, `"612345678"`.

```ts
const { normalizedNumber, block } = registry.lookup("0612345678");

if (block) {
  console.log(block.operatorCode);  // "FRTE"
  console.log(block.operatorName);  // "Orange"
  console.log(block.territoire);    // "Métropole"
  console.log(block.rangeStart);    // 600000000
  console.log(block.rangeEnd);      // 609999999
  console.log(block.attributedAt);  // Date object
}
```

Returns `{ block: null }` if the number doesn't belong to any known range.

#### Short number lookup

##### `lookupShortNumber(shortNumber): ShortNumberLookupResult`

Looks up a short/special number (e.g. `"15"`, `"112"`, `"3008"`). Requires MAJNFB data.

```ts
const { block } = registry.lookupShortNumber("15");
console.log(block?.operatorName); // "Orange"
```

#### Mobile Network Codes

##### `lookupMobileNetworkCode(mccMnc): MobileNetworkCode | null`

Looks up a Mobile Network Code by its MCC-MNC identifier. Requires MAJMNC data.

```ts
const mnc = registry.lookupMobileNetworkCode("20801");
console.log(mnc?.operatorName); // "Orange France"
console.log(mnc?.decision);     // "2000-0001"
```

##### `getMobileNetworkCodes(): MobileNetworkCode[]`

Returns all MCC-MNC entries, sorted by identifier.

#### Number portability

##### `lookupPortability(blockId): PortabilityEntry | null`

Looks up the current operator for a block after number portability. Requires MAJPORTA data.

```ts
const entry = registry.lookupPortability("6000");
console.log(entry?.operatorCode); // "SFR0"
console.log(entry?.operatorName); // "Société française du radiotéléphone"
```

#### Frozen blocks

##### `lookupFrozenBlock(blockId): FrozenBlock | null`

Looks up a frozen number block by its EZABPQM identifier. Requires GELNUM data.

```ts
const frozen = registry.lookupFrozenBlock("08359");
console.log(frozen?.type);              // "Code point sémaphore national"
console.log(frozen?.interestOpensAt);   // Date object
console.log(frozen?.attributionOpensAt); // Date object
```

##### `getFrozenBlocks(): FrozenBlock[]`

Returns all frozen number blocks.

#### Operators & statistics

##### `getBlocksByOperator(operatorCode): PhoneBlock[]`

Returns all blocks assigned to a given operator (case-insensitive).

```ts
const blocks = registry.getBlocksByOperator("FRTE");
console.log(blocks.length); // number of Orange blocks
```

##### `getOperators(): Array<{ code: string; name: string }>`

Lists all operators from the MAJRIO table, sorted alphabetically by code.

##### `getStats()`

Returns aggregate statistics about the loaded registry.

```ts
const stats = registry.getStats();
// { totalBlocks, totalOperators, totalNumbers, blocksWithUnknownOperator }
```

##### `size: number`

Total number of loaded number blocks (getter).

### `parseCsv(filePath)`

Low-level CSV parser. Reads a Latin-1 encoded CSV file with `;` separator and returns an array of row objects.

```ts
import { parseCsv } from "phone-blocks";

const rows = parseCsv("./data/MAJNUM.csv");
```

## Types

All types are exported for use in your own code:

```ts
import type {
  PhoneBlock,
  LookupResult,
  ShortNumberLookupResult,
  MobileNetworkCode,
  PortabilityEntry,
  FrozenBlock,
  Territoire,
  // Raw types (as parsed from CSV)
  RawNumBlock,
  RawOperator,
  RawMobileNetworkCode,
  RawPortability,
  RawFrozenBlock,
} from "phone-blocks";
```

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Type-check
bun run typecheck

# Lint & format (Biome)
bun run check
bun run lint
bun run format

# Run tests
bun run test

# Publish
bun run publish-package
```

## License

[MIT](LICENSE)
