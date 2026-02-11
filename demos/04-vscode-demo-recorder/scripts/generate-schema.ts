#!/usr/bin/env bun
/**
 * Generate JSON Schema from Zod definitions.
 * Run: bun demos/02-vscode-test-electron/scripts/generate-schema.ts
 */

import * as fs from "fs";
import * as path from "path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { RecorderConfigSchema } from "../src/schema.js";

const schemasDir = path.resolve(__dirname, "..", "schemas");
fs.mkdirSync(schemasDir, { recursive: true });

const schema = zodToJsonSchema(RecorderConfigSchema, {
  name: "vscode-demo-recorder-cli",
  $refStrategy: "none",
});

const outPath = path.join(schemasDir, "vscode-demo-recorder.cli.schema.json");
fs.writeFileSync(outPath, JSON.stringify(schema, null, 2) + "\n", "utf-8");
console.log(`✓ Generated: ${outPath}`);
