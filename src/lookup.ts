#!/usr/bin/env bun

import { PhoneBlockRegistry } from "./PhoneBlockRegistry.js";

const phoneNumber = process.argv[2];

if (!phoneNumber) {
	console.error("Usage: bun src/lookup.ts <phone-number>");
	process.exit(1);
}

const registry = PhoneBlockRegistry.fromDataDir();
const { normalizedNumber, block } = registry.lookup(phoneNumber);

if (!block) {
	console.log(
		JSON.stringify(
			{ input: phoneNumber, normalizedNumber, found: false },
			null,
			2,
		),
	);
	process.exit(0);
}

const portability = registry.lookupPortability(String(block.id));

console.log(
	JSON.stringify(
		{
			input: phoneNumber,
			normalizedNumber,
			found: true,
			block: {
				id: block.id,
				rangeStart: block.rangeStart,
				rangeEnd: block.rangeEnd,
				operatorCode: block.operatorCode,
				operatorName: block.operatorName,
				territoire: block.territoire,
				attributedAt: block.attributedAt.toISOString(),
			},
			portability: portability
				? {
						currentOperatorCode: portability.operatorCode,
						currentOperatorName: portability.operatorName,
						portedAt: portability.attributedAt.toISOString(),
					}
				: null,
		},
		null,
		2,
	),
);
