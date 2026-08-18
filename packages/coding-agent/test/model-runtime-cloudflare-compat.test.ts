import { complete, resetApiProviders } from "@earendil-works/pi-ai/compat";
import { describe, expect, it, vi } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { ModelRegistry } from "../src/core/model-registry.ts";
import { ModelRuntime } from "../src/core/model-runtime.ts";

function createFetchMock() {
	return vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => {
		const chunk = {
			id: "chatcmpl-test",
			object: "chat.completion.chunk",
			created: 0,
			model: "test",
			choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
			usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
		};
		return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, {
			status: 200,
			headers: { "content-type": "text/event-stream" },
		});
	});
}

function expectCloudflareRequest(fetchMock: ReturnType<typeof createFetchMock>, expectMaskedHeaders: boolean): void {
	const [input, init] = fetchMock.mock.calls[0];
	const url = input instanceof Request ? input.url : input.toString();
	const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
	expect(url).toBe("https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/compat/chat/completions");
	expect(headers.get("cf-aig-authorization")).toBe("Bearer test-token");
	if (expectMaskedHeaders) {
		expect(headers.has("authorization")).toBe(false);
		expect(headers.has("x-api-key")).toBe(false);
	}
}

async function createCloudflareRuntime(): Promise<{ modelRuntime: ModelRuntime; modelRegistry: ModelRegistry }> {
	const authStorage = AuthStorage.inMemory();
	await authStorage.modify("cloudflare-ai-gateway", async () => ({
		type: "api_key",
		key: "test-token",
		env: {
			CLOUDFLARE_ACCOUNT_ID: "test-account",
			CLOUDFLARE_GATEWAY_ID: "test-gateway",
		},
	}));
	const modelRuntime = await ModelRuntime.create({ credentials: authStorage, modelsPath: null });
	return { modelRuntime, modelRegistry: new ModelRegistry(modelRuntime) };
}

describe("ModelRegistry Cloudflare compat streaming", () => {
	it("materializes the Cloudflare endpoint through ModelRuntime streaming", async () => {
		const { modelRuntime } = await createCloudflareRuntime();
		const model = modelRuntime.getModel("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.6");
		expect(model).toBeDefined();
		expect(model?.api).toBe("openai-completions");

		const fetchMock = createFetchMock();
		resetApiProviders();
		const result = await modelRuntime.completeSimple(model!, { messages: [] }, { fetch: fetchMock });
		expect(result.errorMessage).toBeUndefined();
		expectCloudflareRequest(fetchMock, false);
	});

	it("materializes the Cloudflare endpoint after extension-style auth resolution", async () => {
		const { modelRegistry } = await createCloudflareRuntime();
		const model = modelRegistry.find("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.6");
		expect(model).toBeDefined();

		resetApiProviders();
		const auth = await modelRegistry.getApiKeyAndHeaders(model!);
		expect(auth.ok).toBe(true);
		if (!auth.ok) throw new Error(auth.error);
		expect(auth.headers).toMatchObject({
			"cf-aig-authorization": "Bearer test-token",
			Authorization: null,
			"x-api-key": null,
		});

		const fetchMock = createFetchMock();
		const result = await complete(model!, { messages: [] }, { ...auth, fetch: fetchMock });
		expect(result.errorMessage).toBeUndefined();
		expectCloudflareRequest(fetchMock, true);
	});
});
