import { Editor, type Terminal, TUI } from "@mariozechner/pi-tui";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { InteractiveMode } from "../src/modes/interactive/interactive-mode.js";
import { getEditorTheme, initTheme } from "../src/modes/interactive/theme/theme.js";

class FakeTerminal implements Terminal {
	columns = 80;
	rows = 24;
	kittyProtocolActive = true;

	start(): void {}
	stop(): void {}
	async drainInput(): Promise<void> {}
	write(_data: string): void {}
	moveBy(_lines: number): void {}
	hideCursor(): void {}
	showCursor(): void {}
	clearLine(): void {}
	clearFromCursor(): void {}
	clearScreen(): void {}
	setTitle(_title: string): void {}
	setProgress(_active: boolean): void {}
}

type Harness = {
	editor: Editor;
	lastSigintTime: number;
	ui: { requestRender: ReturnType<typeof vi.fn> };
};

const privateMethods = InteractiveMode.prototype as unknown as {
	handleCtrlC(this: Harness): void;
};

describe("InteractiveMode key handlers", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	test("saves a cleared Ctrl-C draft to editor history", () => {
		const tui = new TUI(new FakeTerminal());
		const editor = new Editor(tui, getEditorTheme());
		editor.setText("half written prompt");
		const requestRender = vi.fn();
		const harness = Object.assign(Object.create(InteractiveMode.prototype), {
			editor,
			lastSigintTime: 0,
			ui: { requestRender },
		}) as Harness;

		privateMethods.handleCtrlC.call(harness);

		expect(editor.getText()).toBe("");
		expect(requestRender).toHaveBeenCalledOnce();

		editor.handleInput("\x1b[A");

		expect(editor.getText()).toBe("half written prompt");
	});
});
