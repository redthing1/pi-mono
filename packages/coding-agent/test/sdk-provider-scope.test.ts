import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Model } from "@mariozechner/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStorage } from "../src/core/auth-storage.js";
import { ModelRegistry } from "../src/core/model-registry.js";
import { createAgentSession } from "../src/core/sdk.js";
import { SessionManager } from "../src/core/session-manager.js";
import { SettingsManager } from "../src/core/settings-manager.js";

function registerModel(modelRegistry: ModelRegistry, provider: string, modelId: string): Model<any> {
	modelRegistry.registerProvider(provider, {
		baseUrl: `https://${provider}.test/v1`,
		apiKey: `${provider}-key`,
		api: "openai-completions",
		models: [
			{
				id: modelId,
				name: modelId,
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 128000,
				maxTokens: 4096,
			},
		],
	});

	const model = modelRegistry.find(provider, modelId);
	if (!model) {
		throw new Error(`Failed to register ${provider}/${modelId}`);
	}
	return model;
}

function createExistingSession(model: Model<any>): SessionManager {
	const sessionManager = SessionManager.inMemory();
	sessionManager.appendModelChange(model.provider, model.id);
	sessionManager.appendMessage({ role: "user", content: "hello", timestamp: 1 });
	return sessionManager;
}

describe("createAgentSession provider scope", () => {
	let tempDir: string;
	let cwd: string;
	let agentDir: string;

	beforeEach(() => {
		tempDir = join(tmpdir(), `pi-provider-scope-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		cwd = join(tempDir, "project");
		agentDir = join(tempDir, "agent");
		mkdirSync(cwd, { recursive: true });
		mkdirSync(agentDir, { recursive: true });
	});

	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("does not restore a session model outside the provider scope", async () => {
		const authStorage = AuthStorage.inMemory();
		const modelRegistry = ModelRegistry.inMemory(authStorage);
		const riskyModel = registerModel(modelRegistry, "risky-provider", "risky-model");
		registerModel(modelRegistry, "safe-provider", "safe-model");
		const sessionManager = createExistingSession(riskyModel);

		const { session, modelFallbackMessage } = await createAgentSession({
			cwd,
			agentDir,
			authStorage,
			modelRegistry,
			settingsManager: SettingsManager.inMemory(),
			sessionManager,
			providerScope: "safe-provider",
		});

		expect(session.model?.provider).toBe("safe-provider");
		expect(session.model?.id).toBe("safe-model");
		expect(modelFallbackMessage).toContain(
			'Session model risky-provider/risky-model is outside provider scope "safe-provider"',
		);
		expect(modelFallbackMessage).toContain("using safe-provider/safe-model");

		session.dispose();
	});

	it("does not fall back globally when no model is available inside the provider scope", async () => {
		const authStorage = AuthStorage.inMemory();
		const modelRegistry = ModelRegistry.inMemory(authStorage);
		const riskyModel = registerModel(modelRegistry, "risky-provider", "risky-model");
		const sessionManager = createExistingSession(riskyModel);

		const { session, modelFallbackMessage } = await createAgentSession({
			cwd,
			agentDir,
			authStorage,
			modelRegistry,
			settingsManager: SettingsManager.inMemory(),
			sessionManager,
			providerScope: "safe-provider",
		});

		expect(session.model?.provider).toBe("unknown");
		expect(modelFallbackMessage).toContain('No authenticated models available for provider "safe-provider"');
		expect(modelFallbackMessage).toContain("Provider scope prevents fallback to another provider");
		expect(modelFallbackMessage).not.toContain("using risky-provider/risky-model");

		session.dispose();
	});
});
