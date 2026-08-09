import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import { type AssistantMessage, createAssistantMessageEventStream, fauxAssistantMessage } from "@earendil-works/pi-ai";
import { getModel, streamSimple } from "@earendil-works/pi-ai/compat";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentSession } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
import { createTestResourceLoader } from "./utilities.ts";

type SessionWithOverflowInternals = {
	_recoverFromContextOverflow: (assistantMessage: AssistantMessage) => Promise<boolean>;
	_runOverflowCompaction: () => Promise<boolean>;
};

describe("AgentSession automatic compaction boundary", () => {
	let session: AgentSession;
	let sessionManager: SessionManager;
	let settingsManager: SettingsManager;
	let tempDir: string;

	beforeEach(async () => {
		tempDir = join(tmpdir(), `pi-auto-compaction-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		const agent = new Agent({
			streamFn: streamSimple,
			initialState: { model, systemPrompt: "Test", tools: [] },
		});
		sessionManager = SessionManager.inMemory();
		settingsManager = SettingsManager.create(tempDir, tempDir);
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		await authStorage.modify("anthropic", async () => ({ type: "api_key", key: "test-key" }));
		const modelRegistry = await createModelRegistry(authStorage, tempDir);
		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader(),
		});
	});

	afterEach(() => {
		session.dispose();
		vi.restoreAllMocks();
		if (existsSync(tempDir)) rmSync(tempDir, { recursive: true });
	});

	it("compacts before inference and continues agent-level queued messages", async () => {
		settingsManager.applyOverrides({ compaction: { keepRecentTokens: 1 } });
		const model = session.model!;
		const threshold = model.contextWindow - settingsManager.getCompactionSettings().reserveTokens + 1;
		const now = Date.now();
		sessionManager.appendMessage({
			role: "user",
			content: [{ type: "text", text: "message to compact" }],
			timestamp: now - 1000,
		});
		sessionManager.appendMessage({
			...fauxAssistantMessage("response to compact", { timestamp: now - 500 }),
			api: model.api,
			provider: model.provider,
			model: model.id,
			usage: {
				input: threshold,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: threshold,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
		});
		session.agent.state.messages = sessionManager.buildSessionContext().messages;
		let responseCount = 0;
		session.agent.streamFunction = (requestModel) => {
			const stream = createAssistantMessageEventStream();
			queueMicrotask(() => {
				stream.push({
					type: "done",
					reason: "stop",
					message: {
						...fauxAssistantMessage(`response ${++responseCount}`),
						api: requestModel.api,
						provider: requestModel.provider,
						model: requestModel.id,
					},
				});
			});
			return stream;
		};
		session.agent.followUp({
			role: "custom",
			customType: "test",
			content: [{ type: "text", text: "queued custom" }],
			display: false,
			timestamp: Date.now(),
		});

		await session.prompt("continue");

		expect(sessionManager.getEntries().filter((entry) => entry.type === "compaction")).toHaveLength(1);
		expect(responseCount).toBe(3);
		expect(session.agent.hasQueuedMessages()).toBe(false);
	});

	it("attempts overflow recovery only once", async () => {
		const model = session.model!;
		const overflowMessage: AssistantMessage = {
			...fauxAssistantMessage("", { stopReason: "error", errorMessage: "prompt is too long" }),
			api: model.api,
			provider: model.provider,
			model: model.id,
		};
		const internals = session as unknown as SessionWithOverflowInternals;
		const compact = vi.spyOn(internals, "_runOverflowCompaction").mockResolvedValue(false);
		const errors: string[] = [];
		session.subscribe((event) => {
			if (event.type === "compaction_end" && event.errorMessage) errors.push(event.errorMessage);
		});

		await internals._recoverFromContextOverflow(overflowMessage);
		await internals._recoverFromContextOverflow({ ...overflowMessage, timestamp: Date.now() + 1 });

		expect(compact).toHaveBeenCalledTimes(1);
		expect(errors).toContain(
			"Context overflow recovery failed after one compact-and-retry attempt. Try reducing context or switching to a larger-context model.",
		);
	});
});
