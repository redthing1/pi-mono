#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const target = process.argv[2];
const bumpTypes = new Set(["major", "minor", "patch"]);
const semverPattern = /^\d+\.\d+\.\d+$/;

if (!target || (!bumpTypes.has(target) && !semverPattern.test(target))) {
	console.error("Usage: node scripts/bump-version.mjs <major|minor|patch|x.y.z>");
	process.exit(1);
}

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJson(path, value) {
	writeFileSync(path, `${JSON.stringify(value, null, "\t")}\n`, "utf-8");
}

function compareVersions(a, b) {
	const aParts = a.split(".").map(Number);
	const bParts = b.split(".").map(Number);
	for (let index = 0; index < 3; index++) {
		const diff = (aParts[index] ?? 0) - (bParts[index] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

function bumpVersion(version, bump) {
	const parts = version.split(".").map(Number);
	if (bump === "major") {
		return `${parts[0] + 1}.0.0`;
	}
	if (bump === "minor") {
		return `${parts[0]}.${parts[1] + 1}.0`;
	}
	return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function expandWorkspace(pattern) {
	if (!pattern.endsWith("/*")) {
		return [pattern];
	}
	const base = pattern.slice(0, -2);
	if (!existsSync(base)) {
		return [];
	}
	return readdirSync(base, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(base, entry.name));
}

const rootPackage = readJson("package.json");
const workspaceDirs = (rootPackage.workspaces ?? []).flatMap(expandWorkspace);
const packageJsonPaths = [
	"package.json",
	...workspaceDirs.map((workspaceDir) => join(workspaceDir, "package.json")).filter(existsSync),
];

const currentVersion = readJson("packages/ai/package.json").version;
const nextVersion = bumpTypes.has(target) ? bumpVersion(currentVersion, target) : target;

if (compareVersions(nextVersion, currentVersion) <= 0) {
	console.error(`Error: version ${nextVersion} must be greater than current version ${currentVersion}.`);
	process.exit(1);
}

for (const packageJsonPath of packageJsonPaths) {
	const pkg = readJson(packageJsonPath);
	if (!pkg.version) {
		continue;
	}
	pkg.version = nextVersion;
	writeJson(packageJsonPath, pkg);
	console.log(`Updated ${packageJsonPath}`);
}

console.log(`Version set to ${nextVersion}`);
