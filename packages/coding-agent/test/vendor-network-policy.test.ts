import { InMemoryModelsStore } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";

describe("fork vendor network policy", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("uses bundled builtin catalogs without contacting pi.dev", async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}", { status: 404 }));
		vi.stubGlobal("fetch", fetchMock);

		const runtime = await ModelRuntime.create({
			credentials: AuthStorage.inMemory(),
			modelsPath: null,
			modelsStore: new InMemoryModelsStore(),
			allowModelNetwork: true,
		});
		await runtime.refresh({ allowNetwork: true });

		const vendorRequests = fetchMock.mock.calls.filter(([input]) => {
			const url = input instanceof Request ? input.url : String(input);
			return new URL(url, "https://local.invalid").hostname === "pi.dev";
		});
		expect(vendorRequests).toEqual([]);
	});
});
