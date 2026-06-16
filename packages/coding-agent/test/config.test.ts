import { join } from "path";
import { afterEach, describe, expect, test } from "vitest";
import {
	detectInstallMethod,
	getSelfUpdateCommand,
	getSelfUpdateUnavailableInstruction,
	getUpdateInstruction,
} from "../src/config.ts";

const execPathDescriptor = Object.getOwnPropertyDescriptor(process, "execPath");
const originalPiPackageDir = process.env.PI_PACKAGE_DIR;

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
			"Run from reviewed source: bun run install:local-pi",
		);
		expect(getSelfUpdateUnavailableInstruction("@earendil-works/pi-coding-agent")).toBe(
			"Self-update is disabled in this fork. Update reviewed source, then run: bun run install:local-pi",
		);
	});
});
