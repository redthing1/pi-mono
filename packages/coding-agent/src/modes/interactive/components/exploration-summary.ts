import { truncateToWidth } from "@mariozechner/pi-tui";
import { invalidArgText, shortenPath, str } from "../../../core/tools/render-utils.js";
import { theme } from "../theme/theme.js";
import type { ToolExecutionSnapshot } from "./tool-execution.js";

const EXPLORATION_TOOL_NAMES = new Set(["read", "grep", "find", "ls"]);
const SEARCH_BASH_COMMANDS = new Set(["ack", "ag", "egrep", "fgrep", "grep", "pt", "rg", "rga", "ripgrep-all"]);
const FIND_BASH_COMMANDS = new Set(["fd", "fdfind", "find"]);
const LIST_BASH_COMMANDS = new Set(["exa", "eza", "ls", "tree"]);
const READ_BASH_COMMANDS = new Set(["bat", "batcat", "cat", "head", "less", "more", "nl", "sed", "tail"]);
const NAVIGATION_BASH_COMMANDS = new Set(["cd", "pwd", "true"]);
const POSTPROCESSING_BASH_COMMANDS = new Set(["awk", "cut", "head", "nl", "sed", "sort", "tail", "uniq", "wc"]);
const UNSAFE_BASH_PATTERN =
	/(^|[;&|]\s*)(bun|chmod|chown|cp|curl|mkdir|mv|node|npm|perl|python|python3|rm|rmdir|sh|tee|touch|wget|xargs)\b|>>?|<\(|\b(find\b[^|;&]*\s(-delete|-exec))\b|\bsed\b[^|;&]*\s-i\b/;

type ObjectArgs = Record<string, unknown>;

export interface BashExplorationSummary {
	label: "Exploring" | "Explored";
	row: string;
}

type ReadonlyBashExploration = {
	action: "find" | "list" | "read" | "search";
	pattern?: string;
	path?: string;
};

export function isExplorationToolName(toolName: string): boolean {
	return EXPLORATION_TOOL_NAMES.has(toolName);
}

export function isExplorationToolSnapshot(snapshot: ToolExecutionSnapshot): boolean {
	if (isExplorationToolName(snapshot.toolName)) return true;
	if (snapshot.toolName !== "bash") return false;
	return formatBashToolSummary(snapshot) !== undefined;
}

export function formatExplorationHeader(snapshots: ToolExecutionSnapshot[], width: number): string {
	const hasActiveTool = snapshots.some((snapshot) => !snapshot.result || snapshot.isPartial);
	const hasError = snapshots.some((snapshot) => snapshot.result?.isError);
	const bullet = hasError ? theme.fg("error", "•") : theme.fg("muted", "•");
	const label = hasActiveTool ? "Exploring" : "Explored";
	return truncateToWidth(`${bullet} ${theme.fg("toolTitle", theme.bold(label))}`, width);
}

export function formatExplorationRows(snapshots: ToolExecutionSnapshot[]): string[] {
	const rows: string[] = [];
	let pendingReadLabels: string[] = [];

	const flushReadLabels = () => {
		if (pendingReadLabels.length === 0) return;
		rows.push(`${formatAction("Read")} ${dedupe(pendingReadLabels).join(theme.fg("muted", ", "))}`);
		pendingReadLabels = [];
	};

	for (const snapshot of snapshots) {
		if (snapshot.toolName === "read") {
			pendingReadLabels.push(formatReadLabel(snapshot));
			continue;
		}

		flushReadLabels();
		rows.push(formatNonReadSummary(snapshot));
	}

	flushReadLabels();
	return rows;
}

export function formatBashExplorationSummary(options: {
	command: string;
	output: string;
	status: "running" | "complete" | "cancelled" | "error";
	exitCode?: number;
}): BashExplorationSummary | undefined {
	const parsed = parseReadonlyBashExploration(options.command);
	if (!parsed) return undefined;

	const label = options.status === "running" ? "Exploring" : "Explored";
	const outputLabels = fileBasenamesFromOutput(options.output);
	const outputSuffix =
		outputLabels.length > 0
			? theme.fg("muted", ` (${outputLabels.slice(0, 5).join(", ")}${outputLabels.length > 5 ? ", ..." : ""})`)
			: "";
	const statusSuffix =
		options.status === "error"
			? theme.fg("error", ` failed${options.exitCode !== undefined ? ` ${options.exitCode}` : ""}`)
			: options.status === "cancelled"
				? theme.fg("warning", " cancelled")
				: "";

	switch (parsed.action) {
		case "search":
			return {
				label,
				row:
					`${formatAction("Search")} ${theme.fg("accent", `/${parsed.pattern || "..."}/`)}` +
					theme.fg("toolOutput", ` in ${formatDisplayPath(parsed.path, ".")}`) +
					outputSuffix +
					statusSuffix,
			};
		case "find":
			return {
				label,
				row:
					`${formatAction("Find")} ${theme.fg("accent", parsed.pattern || "...")}` +
					theme.fg("toolOutput", ` in ${formatDisplayPath(parsed.path, ".")}`) +
					outputSuffix +
					statusSuffix,
			};
		case "list":
			return {
				label,
				row: `${formatAction("List")} ${formatDisplayPath(parsed.path, ".")}${outputSuffix}${statusSuffix}`,
			};
		case "read":
			return {
				label,
				row: `${formatAction("Read")} ${formatDisplayPath(parsed.path, "...")}${outputSuffix}${statusSuffix}`,
			};
	}
}

function parseReadonlyBashExploration(command: string): ReadonlyBashExploration | undefined {
	const normalized = command.trim();
	if (!normalized || UNSAFE_BASH_PATTERN.test(normalized)) return undefined;

	const segments = normalized
		.split(/\s*(?:&&|;|\|)\s*/)
		.map((segment) => segment.trim())
		.filter(Boolean);
	for (const segment of segments) {
		const tokens = tokenizeShellLike(segment);
		const commandName = basename(tokens[0] ?? "");
		if (!commandName || NAVIGATION_BASH_COMMANDS.has(commandName)) {
			continue;
		}
		const summary = summarizeReadonlyBashTokens(commandName, tokens.slice(1));
		if (summary) return summary;
		if (POSTPROCESSING_BASH_COMMANDS.has(commandName)) continue;
		return undefined;
	}
	return undefined;
}

function summarizeReadonlyBashTokens(command: string, tokens: string[]): ReadonlyBashExploration | undefined {
	if (SEARCH_BASH_COMMANDS.has(command)) return summarizeSearchTokens(tokens, command === "rg" || command === "rga");
	if (FIND_BASH_COMMANDS.has(command)) return summarizeFindTokens(command, tokens);
	if (LIST_BASH_COMMANDS.has(command)) return summarizeListTokens(command, tokens);
	if (READ_BASH_COMMANDS.has(command)) return summarizeReadTokens(command, tokens);
	if (command === "git") return summarizeGitTokens(tokens);
	return undefined;
}

function summarizeSearchTokens(tokens: string[], supportsFilesFlag: boolean): ReadonlyBashExploration {
	const regexp = optionValue(tokens, new Set(["-e", "--regexp"]));
	const positional = positionalArgs(tokens, {
		optionsWithValues: new Set([
			"-A",
			"-B",
			"-C",
			"-e",
			"-f",
			"-g",
			"-m",
			"-t",
			"--after-context",
			"--before-context",
			"--context",
			"--file",
			"--glob",
			"--iglob",
			"--max-count",
			"--max-depth",
			"--regexp",
			"--type",
			"--type-add",
			"--type-not",
		]),
	});
	if (supportsFilesFlag && tokens.includes("--files")) {
		return { action: "list", path: positional[0] };
	}
	return {
		action: "search",
		pattern: regexp ?? positional[0],
		path: regexp ? positional[0] : positional[1],
	};
}

function summarizeFindTokens(command: string, tokens: string[]): ReadonlyBashExploration {
	if (command === "find") {
		const pattern = optionValue(tokens, new Set(["-iname", "-name", "-path"]));
		const positional = positionalArgs(tokens, {
			optionsWithValues: new Set(["-maxdepth", "-mindepth", "-name", "-iname", "-path", "-type"]),
		});
		const path = positional[0] ?? ".";
		return pattern ? { action: "find", pattern, path } : { action: "list", path };
	}

	const positional = positionalArgs(tokens, {
		optionsWithValues: new Set(["-E", "-e", "-g", "-t", "--extension", "--glob", "--type"]),
	});
	const pattern = positional[0];
	return pattern ? { action: "find", pattern, path: positional[1] } : { action: "list", path: "." };
}

function summarizeListTokens(command: string, tokens: string[]): ReadonlyBashExploration {
	const optionsWithValues =
		command === "tree"
			? new Set(["-I", "-L", "-P", "--charset", "--filelimit", "--sort"])
			: new Set(["-I", "-w", "--block-size", "--color", "--format", "--ignore-glob", "--quoting-style", "--sort"]);
	const positional = positionalArgs(tokens, { optionsWithValues });
	return { action: "list", path: positional[0] };
}

function summarizeReadTokens(command: string, tokens: string[]): ReadonlyBashExploration | undefined {
	if (command === "sed") {
		const path = sedReadPath(tokens);
		return path ? { action: "read", path } : undefined;
	}

	const optionsWithValues =
		command === "head" || command === "tail"
			? new Set(["-c", "-n", "--bytes", "--lines"])
			: command === "bat" || command === "batcat"
				? new Set([
						"--language",
						"--line-range",
						"--map-syntax",
						"--style",
						"--tabs",
						"--terminal-width",
						"--theme",
					])
				: command === "less"
					? new Set(["-P", "-j", "-p", "-x", "-y", "-z", "--pattern", "--prompt", "--tabs"])
					: command === "nl"
						? new Set(["-b", "-i", "-s", "-v", "-w"])
						: new Set<string>();
	const path = singlePositionalArg(tokens, optionsWithValues);
	return path ? { action: "read", path } : undefined;
}

function summarizeGitTokens(tokens: string[]): ReadonlyBashExploration | undefined {
	const [subcommand, ...tail] = tokens;
	if (subcommand === "grep") {
		return summarizeSearchTokens(tail, false);
	}
	if (subcommand === "ls-files") {
		const positional = positionalArgs(tail, {
			optionsWithValues: new Set(["--exclude", "--exclude-from", "--pathspec-from-file"]),
		});
		return { action: "list", path: positional[0] };
	}
	return undefined;
}

function formatNonReadSummary(snapshot: ToolExecutionSnapshot): string {
	switch (snapshot.toolName) {
		case "grep":
			return formatGrepSummary(snapshot);
		case "find":
			return formatFindSummary(snapshot);
		case "ls":
			return formatLsSummary(snapshot);
		case "bash":
			return formatBashToolSummary(snapshot) ?? `${formatAction(snapshot.toolName)}${formatStatusSuffix(snapshot)}`;
		default:
			return `${formatAction(snapshot.toolName)}${formatStatusSuffix(snapshot)}`;
	}
}

function formatBashToolSummary(snapshot: ToolExecutionSnapshot): string | undefined {
	const args = objectArgs(snapshot.args);
	const command = argString(args, "command");
	if (!command) return undefined;
	const summary = formatBashExplorationSummary({
		command,
		output: textOutput(snapshot),
		status: snapshot.result ? (snapshot.result.isError ? "error" : "complete") : "running",
	});
	return summary?.row;
}

function formatGrepSummary(snapshot: ToolExecutionSnapshot): string {
	const args = objectArgs(snapshot.args);
	const pattern = argString(args, "pattern");
	const path = argString(args, "path");
	const glob = argString(args, "glob");
	let text =
		`${formatAction("Search")} ` +
		(pattern === null ? invalidArgText(theme) : theme.fg("accent", `/${pattern || ""}/`)) +
		theme.fg("toolOutput", ` in ${formatPath(path, ".")}`);
	if (glob) {
		text += theme.fg("toolOutput", ` (${glob})`);
	}

	const matchLimit = numberDetail(snapshot, "matchLimitReached");
	if (matchLimit !== undefined) {
		text += theme.fg("warning", ` limit ${matchLimit}`);
	}
	if (textOutput(snapshot).trim() === "No matches found") {
		text += theme.fg("muted", " no matches");
	}
	return text + formatStatusSuffix(snapshot);
}

function formatFindSummary(snapshot: ToolExecutionSnapshot): string {
	const args = objectArgs(snapshot.args);
	const pattern = argString(args, "pattern");
	const path = argString(args, "path");
	let text =
		`${formatAction("Find")} ` +
		(pattern === null ? invalidArgText(theme) : theme.fg("accent", pattern || "")) +
		theme.fg("toolOutput", ` in ${formatPath(path, ".")}`);

	const resultLimit = numberDetail(snapshot, "resultLimitReached");
	if (resultLimit !== undefined) {
		text += theme.fg("warning", ` limit ${resultLimit}`);
	}
	return text + formatStatusSuffix(snapshot);
}

function formatLsSummary(snapshot: ToolExecutionSnapshot): string {
	const args = objectArgs(snapshot.args);
	const path = argString(args, "path");
	let text = `${formatAction("List")} ${formatPath(path, ".")}`;

	const entryLimit = numberDetail(snapshot, "entryLimitReached");
	if (entryLimit !== undefined) {
		text += theme.fg("warning", ` limit ${entryLimit}`);
	}
	return text + formatStatusSuffix(snapshot);
}

function formatReadLabel(snapshot: ToolExecutionSnapshot): string {
	const args = objectArgs(snapshot.args);
	const rawPath = str(args?.file_path ?? args?.path);
	let label =
		rawPath === null ? invalidArgText(theme) : theme.fg("accent", formatDisplayPath(rawPath || "...", "..."));

	const offset = numberArg(args, "offset");
	const limit = numberArg(args, "limit");
	if (offset !== undefined || limit !== undefined) {
		const startLine = offset ?? 1;
		const endLine = limit !== undefined ? startLine + limit - 1 : undefined;
		label += theme.fg("warning", `:${startLine}${endLine !== undefined ? `-${endLine}` : ""}`);
	}

	return label + formatStatusSuffix(snapshot);
}

function formatStatusSuffix(snapshot: ToolExecutionSnapshot): string {
	if (snapshot.result?.isError) {
		return theme.fg("error", " failed");
	}
	return "";
}

function formatAction(action: string): string {
	return theme.fg("toolTitle", theme.bold(action));
}

function formatPath(value: string | null, fallback: string): string {
	if (value === null) return invalidArgText(theme);
	return theme.fg("accent", formatDisplayPath(value || fallback, fallback));
}

function formatDisplayPath(value: string | undefined, fallback: string): string {
	return basename(value && value.length > 0 ? value : fallback);
}

function basename(value: string): string {
	const shortened = shortenPath(value);
	const normalized = shortened.replace(/\\/g, "/").replace(/\/+$/g, "");
	const label = normalized.split("/").filter(Boolean).pop();
	return label ?? (shortened || value || "...");
}

function objectArgs(args: unknown): ObjectArgs | undefined {
	if (typeof args !== "object" || args === null || Array.isArray(args)) return undefined;
	return args as ObjectArgs;
}

function argString(args: ObjectArgs | undefined, key: string): string | null {
	return str(args?.[key]);
}

function numberArg(args: ObjectArgs | undefined, key: string): number | undefined {
	const value = args?.[key];
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function details(snapshot: ToolExecutionSnapshot): ObjectArgs | undefined {
	const value = snapshot.result?.details;
	if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
	return value as ObjectArgs;
}

function numberDetail(snapshot: ToolExecutionSnapshot, key: string): number | undefined {
	const value = details(snapshot)?.[key];
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function textOutput(snapshot: ToolExecutionSnapshot): string {
	const content = snapshot.result?.content ?? [];
	return content
		.filter((content) => content.type === "text")
		.map((content) => content.text ?? "")
		.join("\n");
}

function dedupe(values: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const value of values) {
		if (seen.has(value)) continue;
		seen.add(value);
		result.push(value);
	}
	return result;
}

function fileBasenamesFromOutput(output: string): string[] {
	const labels = output
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => line.split(":")[0] ?? line)
		.filter((line) => line.includes("/") || line.includes("\\"))
		.map((line) => basename(line));
	return dedupe(labels);
}

function tokenizeShellLike(input: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: "'" | '"' | undefined;
	let escaped = false;

	for (const char of input) {
		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}
		if (char === "\\") {
			escaped = true;
			continue;
		}
		if (quote) {
			if (char === quote) {
				quote = undefined;
			} else {
				current += char;
			}
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			continue;
		}
		if (/\s/.test(char)) {
			if (current) {
				tokens.push(current);
				current = "";
			}
			continue;
		}
		current += char;
	}
	if (current) tokens.push(current);
	return tokens;
}

function optionValue(tokens: string[], optionNames: Set<string>): string | undefined {
	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		if (!token) continue;
		const equalsIndex = token.indexOf("=");
		if (equalsIndex > 0 && optionNames.has(token.slice(0, equalsIndex))) {
			return token.slice(equalsIndex + 1);
		}
		if (optionNames.has(token)) {
			return tokens[index + 1];
		}
	}
	return undefined;
}

function singlePositionalArg(tokens: string[], optionsWithValues: Set<string>): string | undefined {
	const positional = positionalArgs(tokens, { optionsWithValues }).filter((token) => token !== "--");
	return positional.length === 1 ? positional[0] : undefined;
}

function sedReadPath(tokens: string[]): string | undefined {
	if (!tokens.includes("-n")) return undefined;
	const usesScriptOption = tokens.some((token) => token === "-e" || token === "-f");
	const positional = positionalArgs(tokens, { optionsWithValues: new Set(["-e", "-f"]) }).filter(
		(token) => token !== "--",
	);
	if (usesScriptOption) return positional[0];
	return positional.length >= 2 ? positional[positional.length - 1] : undefined;
}

function positionalArgs(tokens: string[], options: { optionsWithValues: Set<string> }): string[] {
	const positional: string[] = [];
	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index];
		if (!token) continue;
		if (token === "--") continue;
		if (options.optionsWithValues.has(token)) {
			index++;
			continue;
		}
		if (token.startsWith("--") && token.includes("=")) continue;
		if (token.startsWith("-")) continue;
		positional.push(token);
	}
	return positional;
}
