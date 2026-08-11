import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseArgs } from "../src/cli/args.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createSessionManager } from "../src/main.ts";

const selectSession = vi.hoisted(() => vi.fn());

vi.mock("../src/cli/session-picker.ts", () => ({ selectSession }));

describe("--resume cancellation", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		vi.clearAllMocks();
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("creates a blank session when the picker is cancelled", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pi-resume-cancel-test-"));
		tempDirs.push(tempDir);
		const cwd = join(tempDir, "project");
		const sessionDir = join(tempDir, "sessions");
		selectSession.mockResolvedValue(undefined);

		const sessionManager = await createSessionManager(
			parseArgs(["--resume"]),
			cwd,
			sessionDir,
			SettingsManager.inMemory(),
		);

		expect(selectSession).toHaveBeenCalledOnce();
		expect(sessionManager.isPersisted()).toBe(true);
		expect(sessionManager.getCwd()).toBe(cwd);
		expect(sessionManager.buildSessionContext().messages).toEqual([]);
	});

	it("opens a selected session with the current cwd override", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pi-resume-cwd-test-"));
		tempDirs.push(tempDir);
		const cwd = join(tempDir, "current");
		const originalCwd = join(tempDir, "original");
		const sessionDir = join(tempDir, "sessions");
		const sessionPath = join(sessionDir, "session.jsonl");
		mkdirSync(cwd, { recursive: true });
		mkdirSync(originalCwd, { recursive: true });
		mkdirSync(sessionDir, { recursive: true });
		writeFileSync(
			sessionPath,
			`${JSON.stringify({
				type: "session",
				version: 3,
				id: "session-id",
				timestamp: new Date().toISOString(),
				cwd: originalCwd,
			})}\n`,
		);
		selectSession.mockResolvedValue({ path: sessionPath, cwdOverride: cwd });

		const sessionManager = await createSessionManager(
			parseArgs(["--resume"]),
			cwd,
			sessionDir,
			SettingsManager.inMemory(),
		);

		expect(sessionManager.getCwd()).toBe(cwd);
		expect(sessionManager.getSessionFile()).toBe(sessionPath);
	});
});
