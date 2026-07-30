import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureTool } from "../src/utils/tools-manager.ts";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("tools manager", () => {
	it("never downloads a missing helper binary", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		await ensureTool("fd", true);

		expect(fetchMock).not.toHaveBeenCalled();
	});
});
