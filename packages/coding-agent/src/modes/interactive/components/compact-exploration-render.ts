import { truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

const FIRST_ROW_PREFIX = "  └ ";
const ROW_PREFIX = "    ";

export function renderCompactExplorationBlock(
	label: "Exploring" | "Explored",
	rows: string[],
	width: number,
): string[] {
	if (width <= 0) return [];
	return [
		"",
		truncateToWidth(`• ${theme.fg("toolTitle", theme.bold(label))}`, width),
		...renderCompactExplorationRows(rows, width),
	];
}

export function renderCompactExplorationRows(rows: string[], width: number): string[] {
	return rows.flatMap((row, index) => renderCompactExplorationRow(row, width, index === 0));
}

function renderCompactExplorationRow(row: string, width: number, first: boolean): string[] {
	const initialPrefix = first ? FIRST_ROW_PREFIX : ROW_PREFIX;
	const contentWidth = Math.max(1, width - initialPrefix.length);
	const wrapped = wrapTextWithAnsi(row, contentWidth);
	return wrapped.map((line, index) => {
		const prefix = index === 0 ? initialPrefix : ROW_PREFIX;
		return truncateToWidth(`${prefix}${line}`, width);
	});
}
