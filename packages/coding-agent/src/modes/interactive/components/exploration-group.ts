import { Container } from "@earendil-works/pi-tui";
import { renderCompactExplorationRows } from "./compact-exploration-render.js";
import {
	formatExplorationHeader,
	formatExplorationRows,
	isExplorationToolName,
	isExplorationToolSnapshot,
} from "./exploration-summary.js";
import type { ToolExecutionComponent } from "./tool-execution.js";

export { isExplorationToolName, isExplorationToolSnapshot };

export class ExplorationGroupComponent extends Container {
	private tools: ToolExecutionComponent[] = [];
	private expanded = false;

	addTool(component: ToolExecutionComponent): void {
		this.insertTool(component, this.tools.length);
	}

	prependTool(component: ToolExecutionComponent): void {
		this.insertTool(component, 0);
	}

	private insertTool(component: ToolExecutionComponent, index: number): void {
		if (this.hasTool(component.getPresentationSnapshot().toolCallId)) return;
		component.setExpanded(this.expanded);
		this.tools.splice(index, 0, component);
		this.refresh();
	}

	refresh(): void {
		this.invalidate();
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		for (const tool of this.tools) {
			tool.setExpanded(expanded);
		}
		this.refresh();
	}

	setShowImages(show: boolean): void {
		for (const tool of this.tools) {
			tool.setShowImages(show);
		}
		this.refresh();
	}

	setImageWidthCells(width: number): void {
		for (const tool of this.tools) {
			tool.setImageWidthCells(width);
		}
		this.refresh();
	}

	hasTool(toolCallId: string): boolean {
		return this.tools.some((tool) => tool.getPresentationSnapshot().toolCallId === toolCallId);
	}

	forEachTool(callback: (component: ToolExecutionComponent) => void): void {
		for (const tool of this.tools) {
			callback(tool);
		}
	}

	override invalidate(): void {
		for (const tool of this.tools) {
			tool.invalidate();
		}
	}

	override render(width: number): string[] {
		if (width <= 0 || this.tools.length === 0) return [];

		const snapshots = this.tools.map((tool) => tool.getPresentationSnapshot());
		const lines = ["", formatExplorationHeader(snapshots, width)];
		const rows = formatExplorationRows(snapshots);
		lines.push(...renderCompactExplorationRows(rows, width));

		if (this.expanded) {
			for (const tool of this.tools) {
				lines.push(...tool.render(width));
			}
		}

		return lines;
	}
}
