import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setKeybindings } from "@earendil-works/pi-tui";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import type { SessionInfo } from "../src/core/session-manager.ts";
import { SessionSelectorComponent } from "../src/modes/interactive/components/session-selector.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

async function flushPromises(): Promise<void> {
	await new Promise<void>((resolve) => setImmediate(resolve));
}

function makeSession(path: string, cwd: string): SessionInfo {
	return {
		path,
		id: "session-id",
		cwd,
		created: new Date(0),
		modified: new Date(0),
		messageCount: 1,
		firstMessage: "hello",
		allMessagesText: "hello",
	};
}

describe("session selector cwd choice", () => {
	const tempDirs: string[] = [];

	beforeAll(() => initTheme("dark"));
	beforeEach(() => setKeybindings(new KeybindingsManager()));
	afterEach(() => {
		for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
	});

	it("asks before resuming a session from another directory", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pi-session-selector-cwd-"));
		tempDirs.push(tempDir);
		const currentCwd = join(tempDir, "current");
		const sessionCwd = join(tempDir, "session");
		mkdirSync(currentCwd);
		mkdirSync(sessionCwd);
		const session = makeSession(join(tempDir, "session.jsonl"), sessionCwd);
		const onSelect = vi.fn();
		const selector = new SessionSelectorComponent(
			async () => [],
			async () => [session],
			onSelect,
			() => {},
			() => {},
			() => {},
			{ currentCwd },
		);
		await flushPromises();

		selector.handleInput("\t");
		await flushPromises();
		selector.handleInput("\r");
		expect(selector.render(120).join("\n")).toContain("Choose working directory to resume this session");
		expect(onSelect).not.toHaveBeenCalled();

		selector.handleInput("\x1b[B");
		selector.handleInput("\r");
		expect(onSelect).toHaveBeenCalledWith({ path: session.path, cwdOverride: currentCwd });
	});

	it("keeps the original session directory as the default choice", async () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pi-session-selector-cwd-default-"));
		tempDirs.push(tempDir);
		const currentCwd = join(tempDir, "current");
		const sessionCwd = join(tempDir, "session");
		mkdirSync(currentCwd);
		mkdirSync(sessionCwd);
		const session = makeSession(join(tempDir, "session.jsonl"), sessionCwd);
		const onSelect = vi.fn();
		const selector = new SessionSelectorComponent(
			async () => [],
			async () => [session],
			onSelect,
			() => {},
			() => {},
			() => {},
			{ currentCwd },
		);
		await flushPromises();

		selector.handleInput("\t");
		await flushPromises();
		selector.handleInput("\r");
		selector.handleInput("\r");

		expect(onSelect).toHaveBeenCalledWith({ path: session.path });
	});
});
