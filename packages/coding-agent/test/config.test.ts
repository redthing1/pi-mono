import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
	detectInstallMethod,
	findNodePackageDir,
	getSelfUpdateCommand,
	getSelfUpdateUnavailableInstruction,
	getUpdateInstruction,
} from "../src/config.ts";

const execPathDescriptor = Object.getOwnPropertyDescriptor(process, "execPath");
const originalPiPackageDir = process.env.PI_PACKAGE_DIR;
let tempDir: string | undefined;

function setExecPath(value: string): void {
	Object.defineProperty(process, "execPath", {
		value,
		configurable: true,
	});
}

afterEach(() => {
	if (execPathDescriptor) {
		Object.defineProperty(process, "execPath", execPathDescriptor);
	}
	if (originalPiPackageDir === undefined) {
		delete process.env.PI_PACKAGE_DIR;
	} else {
		process.env.PI_PACKAGE_DIR = originalPiPackageDir;
	}
	if (tempDir) {
		rmSync(tempDir, { recursive: true, force: true });
		tempDir = undefined;
	}
});

describe("findNodePackageDir", () => {
	test("skips binary metadata copied into dist", () => {
		tempDir = mkdtempSync(join(tmpdir(), "pi-package-dir-"));
		const distDir = join(tempDir, "dist");
		const bundleDir = join(distDir, "bundle");
		mkdirSync(bundleDir, { recursive: true });
		writeFileSync(join(tempDir, "package.json"), "{}");
		writeFileSync(join(distDir, "package.json"), "{}");

		expect(findNodePackageDir(bundleDir)).toBe(tempDir);
	});
});
describe("detectInstallMethod", () => {
	test("detects pnpm from Windows .pnpm install paths", () => {
		setExecPath(
			"C:\\Users\\Admin\\Documents\\pnpm-repository\\global\\5\\.pnpm\\@earendil-works+pi-coding-agent@0.67.68\\node_modules\\@earendil-works\\pi-coding-agent\\dist\\cli.js",
		);

		expect(detectInstallMethod()).toBe("pnpm");
	});

	test("detects bun runtime wrapper installs", () => {
		setExecPath("/usr/local/bin/node");

		expect(detectInstallMethod()).toBe("bun");
	});

	test("detects bun global installs from package paths", () => {
		const packageDir = join(
			process.env.HOME ?? "/tmp",
			".bun",
			"install",
			"global",
			"node_modules",
			"@earendil-works",
			"pi-coding-agent",
		);
		process.env.PI_PACKAGE_DIR = packageDir;
		setExecPath(join(packageDir, "dist", "cli.js"));

		expect(detectInstallMethod()).toBe("bun");
	});

	test("disables self-update command generation for all install methods", () => {
		expect(getSelfUpdateCommand("@earendil-works/pi-coding-agent")).toBeUndefined();
		expect(getSelfUpdateCommand("@mariozechner/pi-coding-agent", undefined, "@new-scope/pi")).toBeUndefined();
	});

	test("returns fork source-install update guidance", () => {
		expect(getUpdateInstruction("@earendil-works/pi-coding-agent")).toBe(
			"Automatic updates are disabled. Use a reviewed local build.",
		);
		expect(getSelfUpdateUnavailableInstruction("@earendil-works/pi-coding-agent")).toBe(
			"Self-update is disabled in this fork. Replace pi only from a reviewed local build.",
		);
	});
});
