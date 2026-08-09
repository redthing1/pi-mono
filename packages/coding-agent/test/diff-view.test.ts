import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it } from "vitest";
import { countDiffLines, DiffView } from "../src/modes/interactive/components/diff.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

function renderPlain(view: DiffView, width: number): string[] {
	return view.render(width).map((line) => stripTerminalSequences(line));
}

describe("DiffView", () => {
	beforeAll(() => {
		initTheme("dark");
	});

	it("renders aligned Codex-style gutters and hunk separators", () => {
		const diff = ["  9 before", "-10 const value = before;", "+10 const value = after;", "    ...", " 12 after"].join(
			"\n",
		);
		const lines = renderPlain(new DiffView(diff, { filePath: "example.ts" }), 40);

		expect(lines[0]).toContain("     9  before");
		expect(lines[1]).toContain("    10 -const value = before;");
		expect(lines[2]).toContain("    10 +const value = after;");
		expect(lines[3]).toContain("       ⋮");
		expect(lines[3]).not.toContain("...");
		expect(lines.every((line) => visibleWidth(line) === 40)).toBe(true);
	});

	it("wraps long content with continuation text aligned after the gutter", () => {
		const view = new DiffView("+42 const message = a deliberately long replacement value;");
		const lines = renderPlain(view, 24);

		expect(lines.length).toBeGreaterThan(1);
		expect(lines[0]).toContain("    42 +");
		for (const line of lines.slice(1)) {
			expect(line.startsWith("        ")).toBe(true);
		}
		expect(lines.every((line) => visibleWidth(line) === 24)).toBe(true);
	});

	it("never exceeds the available width in narrow layouts", () => {
		for (let width = 1; width <= 10; width++) {
			const lines = new DiffView("+123 abc").render(width);
			expect(lines.length).toBeGreaterThan(0);
			expect(lines.every((line) => visibleWidth(line) === width)).toBe(true);
		}
	});

	it("counts only added and removed rows", () => {
		expect(countDiffLines([" 1 context", "-2 old", "+2 new", "+3 more", "   ..."].join("\n"))).toEqual({
			added: 2,
			removed: 1,
		});
	});

	it("uses the active theme without changing layout", () => {
		const view = new DiffView("+1 added");
		const dark = view.render(24)[0];

		initTheme("light");
		view.invalidate();
		const light = view.render(24)[0];
		initTheme("dark");

		expect(light).not.toBe(dark);
		expect(stripTerminalSequences(light)).toBe(stripTerminalSequences(dark));
	});

	it("uses the file path for syntax highlighting without changing content", () => {
		const plain = new DiffView("+1 const value = true;").render(40)[0];
		const highlighted = new DiffView("+1 const value = true;", { filePath: "example.ts" }).render(40)[0];

		expect(highlighted).not.toBe(plain);
		expect(stripTerminalSequences(highlighted)).toBe(stripTerminalSequences(plain));
	});
});
