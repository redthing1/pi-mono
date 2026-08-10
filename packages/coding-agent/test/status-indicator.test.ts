import type { TUI } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	CompactionStatusIndicator,
	IdleStatus,
	RetryStatusIndicator,
} from "../src/modes/interactive/components/status-indicator.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

describe("status indicators", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps idle status at the same height as status indicators", () => {
		const idleStatus = new IdleStatus();

		const lines = idleStatus.render(20);
		expect(lines).toHaveLength(2);
		expect(lines).toEqual([" ".repeat(20), " ".repeat(20)]);
	});

	it("disposes retry countdown updates", () => {
		initTheme("dark");
		vi.useFakeTimers();
		const requestRender = vi.fn();
		const tui = { requestRender } as unknown as TUI;
		const indicator = new RetryStatusIndicator(tui, 1, 3, 1000);
		const callsBeforeDispose = requestRender.mock.calls.length;

		indicator.dispose();
		vi.advanceTimersByTime(2000);

		expect(requestRender).toHaveBeenCalledTimes(callsBeforeDispose);
	});

	it("adds and clears compaction detail", () => {
		initTheme("dark");
		const tui = { requestRender: vi.fn() } as unknown as TUI;
		const indicator = new CompactionStatusIndicator(tui, "manual");

		indicator.setDetail("request progress");
		const withDetail = stripAnsi(indicator.render(120).join("\n"));
		expect(withDetail).toContain("Compacting context... request progress");

		indicator.setDetail();
		const withoutDetail = stripAnsi(indicator.render(120).join("\n"));
		expect(withoutDetail).toContain("Compacting context...");
		expect(withoutDetail).not.toContain("request progress");
		indicator.dispose();
	});
});
