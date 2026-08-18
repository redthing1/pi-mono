import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { describe, expect, it, vi } from "vitest";
import type { SessionEntry } from "../src/core/session-manager.ts";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.ts";

type SubmitContext = {
	defaultEditor: { onSubmit?: (text: string) => void };
	editor: {
		addToHistory?: (text: string) => void;
		setText: (text: string) => void;
	};
	session: {
		isCompacting: boolean;
		isStreaming: boolean;
		isBashRunning: boolean;
		prompt: (text: string, options?: unknown) => Promise<void>;
	};
	flushPendingBashComponents: () => void;
	onInputCallback?: (text: string) => void;
	pendingUserInputs: string[];
};

type InputContext = {
	onInputCallback?: (text: string) => void;
	pendingUserInputs: string[];
};

type RenderInitialMessagesContext = {
	defaultEditor: {
		clearHistory(): void;
	};
	editor: { addToHistory?(text: string): void };
	sessionManager: {
		getEntries(): SessionEntry[];
		buildContextEntries(): SessionEntry[];
	};
	renderSessionEntries(entries: SessionEntry[], options?: { updateFooter?: boolean }): void;
	renderProjectTrustWarningIfNeeded(): void;
	getUserMessageText(message: AgentMessage): string;
	showStatus(message: string): void;
};

type StartupSubmitContext = {
	editor: { setText: (text: string) => void };
	showStatus: (message: string) => void;
};

type InteractiveModePrivate = {
	handleStartupSubmit(this: StartupSubmitContext, text: string): void;
	setupEditorSubmitHandler(this: SubmitContext): void;
	getUserInput(this: InputContext): Promise<string>;
	getUserMessageText(message: AgentMessage): string;
	renderInitialMessages(this: RenderInitialMessagesContext): void;
};

const interactiveModePrototype = InteractiveMode.prototype as unknown as InteractiveModePrivate;

function createSubmitContext(): SubmitContext {
	return {
		defaultEditor: {},
		editor: {
			addToHistory: vi.fn(),
			setText: vi.fn(),
		},
		session: {
			isCompacting: false,
			isStreaming: false,
			isBashRunning: false,
			prompt: vi.fn(async () => {}),
		},
		flushPendingBashComponents: vi.fn(),
		pendingUserInputs: [],
	};
}

function createUserEntry(id: string, parentId: string | null, text: string, timestamp: number): SessionEntry {
	return {
		type: "message",
		id,
		parentId,
		timestamp: new Date(timestamp).toISOString(),
		message: { role: "user", content: text, timestamp },
	};
}

describe("InteractiveMode startup input", () => {
	it("restores a prompt submitted while managed-tool setup is running", () => {
		const context: StartupSubmitContext = {
			editor: { setText: vi.fn() },
			showStatus: vi.fn(),
		};

		interactiveModePrototype.handleStartupSubmit.call(context, "early prompt");

		expect(context.editor.setText).toHaveBeenCalledWith("early prompt");
		expect(context.showStatus).toHaveBeenCalledWith("Startup is still in progress");
	});

	it("queues a normal prompt submitted before the input callback is installed", async () => {
		const context = createSubmitContext();
		interactiveModePrototype.setupEditorSubmitHandler.call(context);

		await context.defaultEditor.onSubmit?.(" early prompt ");

		expect(context.pendingUserInputs).toEqual(["early prompt"]);
		expect(context.flushPendingBashComponents).toHaveBeenCalledTimes(1);
		expect(context.editor.addToHistory).toHaveBeenCalledWith("early prompt");
	});

	it("returns queued startup input before installing a new input callback", async () => {
		const context: InputContext = {
			pendingUserInputs: ["queued prompt"],
		};

		await expect(interactiveModePrototype.getUserInput.call(context)).resolves.toBe("queued prompt");
		expect(context.onInputCallback).toBeUndefined();
		expect(context.pendingUserInputs).toEqual([]);
	});

	it("restores prompt history from every session branch in global recency order", () => {
		const rootPrompt = createUserEntry("root", null, "root prompt", 1);
		const abandonedBranchPrompt = createUserEntry("branch-a", "root", "abandoned branch prompt", 2);
		const activeBranchPrompt = createUserEntry("branch-b", "root", "active branch prompt", 3);
		const allEntries = [rootPrompt, abandonedBranchPrompt, activeBranchPrompt];
		const activeEntries = [rootPrompt, activeBranchPrompt];
		const history: string[] = [];
		const renderSessionEntries = vi.fn();
		const context: RenderInitialMessagesContext = {
			defaultEditor: {
				clearHistory: () => history.splice(0),
			},
			editor: { addToHistory: (text: string) => history.unshift(text) },
			sessionManager: {
				getEntries: () => allEntries,
				buildContextEntries: () => activeEntries,
			},
			renderSessionEntries,
			renderProjectTrustWarningIfNeeded: vi.fn(),
			getUserMessageText: interactiveModePrototype.getUserMessageText,
			showStatus: vi.fn(),
		};

		interactiveModePrototype.renderInitialMessages.call(context);

		expect(history).toEqual(["active branch prompt", "abandoned branch prompt", "root prompt"]);
		expect(renderSessionEntries).toHaveBeenCalledWith(activeEntries, { updateFooter: true });
	});
});
