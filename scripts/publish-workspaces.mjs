#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dryRun = process.argv.includes("--dry-run");

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf-8"));
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

function run(command, args) {
	console.log(`$ ${[command, ...args].join(" ")}`);
	const result = spawnSync(command, args, { stdio: "inherit" });
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

const rootPackage = readJson("package.json");
const workspaceDirs = (rootPackage.workspaces ?? []).flatMap(expandWorkspace);

for (const workspaceDir of workspaceDirs) {
	const packageJsonPath = join(workspaceDir, "package.json");
	if (!existsSync(packageJsonPath)) {
		continue;
	}
	const pkg = readJson(packageJsonPath);
	if (pkg.private) {
		continue;
	}
	const args = ["publish", "--cwd", workspaceDir, "--access", "public"];
	if (dryRun) {
		args.push("--dry-run");
	}
	run("bun", args);
}
