import { getModel, type Usage } from "@mariozechner/pi-ai";
import { Container } from "@mariozechner/pi-tui";
import stripAnsi from "strip-ansi";
import { beforeAll, describe, expect, test, vi } from "vitest";
import type { SessionContext } from "../src/core/session-manager.js";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.js";
import { getMarkdownTheme, initTheme } from "../src/modes/interactive/theme/theme.js";

const model = getModel("anthropic", "claude-sonnet-4-5");

function createUsage(): Usage {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			total: 0,
		},
	};
}

function createHarness(options: { compactExploration?: boolean } = {}) {
	const settingsManager = {
		getShowImages: () => true,
		getImageWidthCells: () => 60,
		getCompactExploration: () => options.compactExploration ?? true,
	};
	const sessionManager = {
		getCwd: () => process.cwd(),
	};
	const session = {
		getToolDefinition: () => undefined,
		retryAttempt: 0,
		settingsManager,
		sessionManager,
	};

	return Object.assign(Object.create(InteractiveMode.prototype), {
		runtimeHost: { session },
		chatContainer: new Container(),
		pendingTools: new Map(),
		lastExplorationGroup: undefined,
		toolOutputExpanded: false,
		hideThinkingBlock: false,
		hiddenThinkingLabel: "Thinking...",
		customHeader: undefined,
		builtInHeader: undefined,
		footer: { invalidate: vi.fn() },
		ui: { requestRender: vi.fn() },
		updateEditorBorderColor: vi.fn(),
		getMarkdownThemeWithSettings: () => getMarkdownTheme(),
	});
}

function renderChat(chatContainer: Container): string {
	return stripAnsi(chatContainer.render(120).join("\n"));
}

describe("InteractiveMode exploration rendering", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	test("replays read tool calls as compact exploration groups and expands to detailed output", () => {
		if (!model) throw new Error("Expected test model to exist");
		const harness = createHarness();
		const sessionContext: SessionContext = {
			thinkingLevel: "off",
			model: { provider: model.provider, modelId: model.id },
			messages: [
				{
					role: "assistant",
					content: [{ type: "toolCall", id: "tool-read-1", name: "read", arguments: { path: "src/read.ts" } }],
					api: model.api,
					provider: model.provider,
					model: model.id,
					usage: createUsage(),
					stopReason: "toolUse",
					timestamp: 1,
				},
				{
					role: "toolResult",
					toolCallId: "tool-read-1",
					toolName: "read",
					content: [{ type: "text", text: "line one\nline two" }],
					isError: false,
					timestamp: 2,
				},
			],
		};
		const renderSessionContext = Reflect.get(InteractiveMode.prototype, "renderSessionContext") as (
			this: ReturnType<typeof createHarness>,
			sessionContext: SessionContext,
		) => void;
		renderSessionContext.call(harness, sessionContext);

		const collapsed = renderChat(harness.chatContainer);
		expect(collapsed).toContain("Explored");
		expect(collapsed).toContain("Read read.ts");
		expect(collapsed).not.toContain("line one");
		expect(collapsed).not.toContain("line two");

		const setToolsExpanded = Reflect.get(InteractiveMode.prototype, "setToolsExpanded") as (
			this: ReturnType<typeof createHarness>,
			expanded: boolean,
		) => void;
		setToolsExpanded.call(harness, true);

		const expanded = renderChat(harness.chatContainer);
		expect(expanded).toContain("Read read.ts");
		expect(expanded).toContain("read src/read.ts");
		expect(expanded).toContain("line one");
		expect(expanded).toContain("line two");
	});

	test("replays detailed tool output when compact exploration is disabled", () => {
		if (!model) throw new Error("Expected test model to exist");
		const harness = createHarness({ compactExploration: false });
		const sessionContext: SessionContext = {
			thinkingLevel: "off",
			model: { provider: model.provider, modelId: model.id },
			messages: [
				{
					role: "assistant",
					content: [{ type: "toolCall", id: "tool-read-2", name: "read", arguments: { path: "src/read.ts" } }],
					api: model.api,
					provider: model.provider,
					model: model.id,
					usage: createUsage(),
					stopReason: "toolUse",
					timestamp: 1,
				},
				{
					role: "toolResult",
					toolCallId: "tool-read-2",
					toolName: "read",
					content: [{ type: "text", text: "line one\nline two" }],
					isError: false,
					timestamp: 2,
				},
			],
		};
		const renderSessionContext = Reflect.get(InteractiveMode.prototype, "renderSessionContext") as (
			this: ReturnType<typeof createHarness>,
			sessionContext: SessionContext,
		) => void;
		renderSessionContext.call(harness, sessionContext);

		const rendered = renderChat(harness.chatContainer);
		expect(rendered).not.toContain("Explored");
		expect(rendered).toContain("read src/read.ts");
		expect(rendered).toContain("line one");
	});
});
