import { getModel, type Usage } from "@earendil-works/pi-ai/compat";
import { Container } from "@earendil-works/pi-tui";
import stripAnsi from "strip-ansi";
import { beforeAll, describe, expect, test, vi } from "vitest";
import type { SessionContext } from "../src/core/session-manager.ts";
import type { ExplorationGroupComponent } from "../src/modes/interactive/components/exploration-group.ts";
import type { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";
import { getMarkdownTheme, initTheme } from "../src/modes/interactive/theme/theme.ts";

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
		loadedResourcesContainer: new Container(),
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

type Harness = ReturnType<typeof createHarness>;

type TestPendingToolView = {
	component: ToolExecutionComponent;
	group?: ExplorationGroupComponent;
};

const privateMethods = InteractiveMode.prototype as unknown as {
	renderSessionContext(this: Harness, sessionContext: SessionContext): void;
	setToolsExpanded(this: Harness, expanded: boolean): void;
	createToolExecutionComponent(
		this: Harness,
		toolName: string,
		toolCallId: string,
		args: unknown,
		options?: { argsComplete?: boolean },
	): ToolExecutionComponent;
	attachToolExecutionComponent(this: Harness, component: ToolExecutionComponent): TestPendingToolView;
	finalizeToolViewArgs(this: Harness, view: TestPendingToolView): TestPendingToolView;
	promoteToolViewIfExploration(this: Harness, view: TestPendingToolView): TestPendingToolView;
	refreshToolView(this: Harness, view: TestPendingToolView): void;
};

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
		privateMethods.renderSessionContext.call(harness, sessionContext);

		const collapsed = renderChat(harness.chatContainer);
		expect(collapsed).toContain("Explored");
		expect(collapsed).toContain("Read read.ts");
		expect(collapsed).not.toContain("line one");
		expect(collapsed).not.toContain("line two");

		privateMethods.setToolsExpanded.call(harness, true);

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
		privateMethods.renderSessionContext.call(harness, sessionContext);
		privateMethods.setToolsExpanded.call(harness, true);

		const rendered = renderChat(harness.chatContainer);
		expect(rendered).not.toContain("Explored");
		expect(rendered).toContain("read src/read.ts");
		expect(rendered).toContain("line one");
	});

	test("promotes live bash tool view to compact exploration after streamed args complete", () => {
		const harness = createHarness();
		const readComponent = privateMethods.createToolExecutionComponent.call(harness, "read", "tool-read-live", {
			path: "src/read.ts",
		});
		const readView = privateMethods.attachToolExecutionComponent.call(harness, readComponent);
		readView.component.updateResult({
			content: [{ type: "text", text: "line one" }],
			isError: false,
		});
		privateMethods.refreshToolView.call(harness, readView);

		const component = privateMethods.createToolExecutionComponent.call(harness, "bash", "tool-bash-live", {});
		let view = privateMethods.attachToolExecutionComponent.call(harness, component);
		expect(view.group).toBeUndefined();

		view.component.updateArgs({
			command: 'rg -n "skill" packages/coding-agent/src/ --no-heading 2>/dev/null | head -30',
		});
		view = privateMethods.promoteToolViewIfExploration.call(harness, view);
		expect(view.group).toBeUndefined();
		view = privateMethods.finalizeToolViewArgs.call(harness, view);
		view.component.updateResult({
			content: [{ type: "text", text: "packages/coding-agent/src/core/skills.ts:1:skill" }],
			isError: false,
		});
		privateMethods.refreshToolView.call(harness, view);

		const rendered = renderChat(harness.chatContainer);
		expect(view.group).toBe(readView.group);
		expect(view.group).toBeDefined();
		expect(rendered).toContain("Explored");
		expect(rendered.match(/Explored/g)).toHaveLength(1);
		expect(rendered).toContain("Search /skill/ in src");
		expect(rendered).not.toContain("$ rg");
	});

	test("promotes completed bash placeholder before a following exploration group", () => {
		const harness = createHarness();
		const component = privateMethods.createToolExecutionComponent.call(harness, "bash", "tool-bash-before-read", {});
		let view = privateMethods.attachToolExecutionComponent.call(harness, component);

		const readComponent = privateMethods.createToolExecutionComponent.call(harness, "read", "tool-read-after-bash", {
			path: "src/read.ts",
		});
		const readView = privateMethods.attachToolExecutionComponent.call(harness, readComponent);
		readView.component.updateResult({
			content: [{ type: "text", text: "line one" }],
			isError: false,
		});
		privateMethods.refreshToolView.call(harness, readView);

		view.component.updateArgs({ command: 'rg -n "skill" packages/coding-agent/src' });
		view = privateMethods.finalizeToolViewArgs.call(harness, view);
		view.component.updateResult({
			content: [{ type: "text", text: "packages/coding-agent/src/core/skills.ts:1:skill" }],
			isError: false,
		});
		privateMethods.refreshToolView.call(harness, view);

		const rendered = renderChat(harness.chatContainer);
		expect(view.group).toBe(readView.group);
		expect(rendered.match(/Explored/g)).toHaveLength(1);
		expect(rendered.indexOf("Search /skill/ in src")).toBeLessThan(rendered.indexOf("Read read.ts"));
		expect(rendered).not.toContain("$ rg");
	});
});
