import { readFileSync } from "node:fs";

const rootPackage = JSON.parse(readFileSync("package.json", "utf8"));
const aiPackage = JSON.parse(readFileSync("packages/ai/package.json", "utf8"));
const cliSource = readFileSync("packages/coding-agent/src/cli.ts", "utf8");

const expectedBuildPi =
	"cd packages/tui && bun run build && cd ../ai && bun run build:offline && cd ../agent && bun run build && cd ../coding-agent && bun run build";
const expectedInstall =
	"bun install --frozen-lockfile --ignore-scripts && bun run build:pi && bun link --cwd packages/coding-agent && bun link --global @earendil-works/pi-coding-agent";

const failures = [];

if (rootPackage.scripts["build:pi"] !== expectedBuildPi) {
	failures.push("build:pi must use packages/ai build:offline");
}

if (rootPackage.scripts["install:local-pi"] !== expectedInstall) {
	failures.push("install:local-pi must use the frozen lockfile, skip lifecycle scripts, and use local bun links");
}

if (aiPackage.scripts["build:offline"] === undefined || aiPackage.scripts["build:offline"].includes("generate-models")) {
	failures.push("the AI package must retain an offline build separate from model generation");
}

if (!cliSource.startsWith("#!/usr/bin/env -S bun --no-install\n")) {
	failures.push("the CLI launcher must disable Bun runtime auto-install");
}

if (failures.length > 0) {
	console.error("Local Pi installation safety checks failed:");
	for (const failure of failures) console.error(`  ${failure}`);
	process.exit(1);
}
