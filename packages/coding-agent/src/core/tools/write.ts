import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Box, Container, Spacer, Text } from "@earendil-works/pi-tui";
import { mkdir as fsMkdir, writeFile as fsWriteFile } from "fs/promises";
import { dirname } from "path";
import { type Static, Type } from "typebox";
import { DiffView } from "../../modes/interactive/components/diff.ts";
import type { Theme } from "../../modes/interactive/theme/theme.ts";
import { getExperimentalToolSampling } from "../experimental.ts";
import type { ToolDefinition } from "../extensions/types.ts";
import { withFileMutationQueue } from "./file-mutation-queue.ts";
import { resolveToCwd } from "./path-utils.ts";
import { normalizeDisplayText, renderToolPath, str } from "./render-utils.ts";
import { wrapToolDefinition } from "./tool-definition-wrapper.ts";

const writeSchema = Type.Object({
	path: Type.String({ description: "Path to the file to write (relative or absolute)" }),
	content: Type.String({ description: "Content to write to the file" }),
});

export const writeToolSystemPromptContribution = {
	snippet: "Create or overwrite files",
	guidelines: ["Use write only for new files or complete rewrites."],
} as const;

export type WriteToolInput = Static<typeof writeSchema>;

/**
 * Pluggable operations for the write tool.
 * Override these to delegate file writing to remote systems (for example SSH).
 */
export interface WriteOperations {
	/** Write content to a file */
	writeFile: (absolutePath: string, content: string) => Promise<void>;
	/** Create directory recursively */
	mkdir: (dir: string) => Promise<void>;
	/** Serialize mutations for this backend. Defaults to the local filesystem queue. */
	mutationQueue?: typeof withFileMutationQueue;
}

const defaultWriteOperations: WriteOperations = {
	writeFile: (path, content) => fsWriteFile(path, content, "utf-8"),
	mkdir: (dir) => fsMkdir(dir, { recursive: true }).then(() => {}),
};

export interface WriteToolOptions {
	/** Custom operations for file writing. Default: local filesystem */
	operations?: WriteOperations;
}

type WriteRenderStatus = "pending" | "success" | "error";

class WriteCallRenderComponent extends Box {
	diffView?: DiffView;

	constructor() {
		super(0, 0);
	}
}

function trimTrailingEmptyLines(lines: string[]): string[] {
	let end = lines.length;
	while (end > 0 && lines[end - 1] === "") {
		end--;
	}
	return lines.slice(0, end);
}

function formatWriteCall(
	args: { path?: string; file_path?: string } | undefined,
	lineCount: number | undefined,
	status: WriteRenderStatus,
	theme: Theme,
	cwd: string,
): string {
	const rawPath = str(args?.file_path ?? args?.path);
	const pathDisplay = renderToolPath(rawPath, theme, cwd);
	const marker = status === "error" ? theme.fg("error", "×") : theme.fg("muted", "•");
	const title = status === "error" ? "Failed to write" : status === "success" ? "Wrote" : "Writing";
	const styledTitle = theme.fg(status === "error" ? "error" : "toolTitle", theme.bold(title));
	let counts = "";
	if (lineCount !== undefined) {
		counts = ` ${theme.fg("muted", "(")}${theme.fg("toolDiffAdded", `+${lineCount}`)} ${theme.fg("toolDiffRemoved", "-0")}${theme.fg("muted", ")")}`;
	}
	return `${marker} ${styledTitle} ${pathDisplay}${counts}`;
}

function buildWriteCallComponent(
	component: WriteCallRenderComponent,
	args: { path?: string; file_path?: string; content?: string } | undefined,
	expanded: boolean,
	status: WriteRenderStatus,
	theme: Theme,
	cwd: string,
): WriteCallRenderComponent {
	const rawPath = str(args?.file_path ?? args?.path);
	const fileContent = str(args?.content);
	const lines =
		fileContent === null ? undefined : trimTrailingEmptyLines(normalizeDisplayText(fileContent).split("\n"));
	component.clear();
	component.addChild(new Text(formatWriteCall(args, lines?.length, status, theme, cwd), 0, 0));

	if (lines && lines.length > 0) {
		const visibleLines = expanded ? lines : lines.slice(0, 10);
		const rows = visibleLines.map((line, index) => `+${index + 1} ${line}`);
		if (visibleLines.length < lines.length) rows.push("    ...");
		const diff = rows.join("\n");
		if (component.diffView) {
			component.diffView.setDiff(diff, { filePath: rawPath ?? undefined });
		} else {
			component.diffView = new DiffView(diff, { filePath: rawPath ?? undefined });
		}
		component.addChild(component.diffView);
	} else if (fileContent === null) {
		component.addChild(new Text(theme.fg("error", "[invalid content arg - expected string]"), 1, 0));
	}

	return component;
}

function formatWriteResult(
	result: { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>; isError?: boolean },
	theme: Theme,
): string | undefined {
	if (!result.isError) {
		return undefined;
	}
	const output = result.content
		.filter((c) => c.type === "text")
		.map((c) => c.text || "")
		.join("\n");
	if (!output) {
		return undefined;
	}
	return theme.fg("error", output);
}

export function createWriteToolDefinition(
	cwd: string,
	options?: WriteToolOptions,
): ToolDefinition<typeof writeSchema, undefined> {
	const ops = options?.operations ?? defaultWriteOperations;
	const mutationQueue = ops.mutationQueue ?? withFileMutationQueue;
	return {
		name: "write",
		label: "write",
		description:
			"Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories.",
		promptSnippet: writeToolSystemPromptContribution.snippet,
		promptGuidelines: [...writeToolSystemPromptContribution.guidelines],
		parameters: writeSchema,
		renderShell: "self",
		constrainedSampling: getExperimentalToolSampling(),
		async execute(
			_toolCallId,
			{ path, content }: { path: string; content: string },
			signal?: AbortSignal,
			_onUpdate?,
			_ctx?,
		) {
			const absolutePath = resolveToCwd(path, cwd);
			const dir = dirname(absolutePath);
			return mutationQueue(absolutePath, async () => {
				// Do not reject from an abort event listener here: that would release the
				// mutation queue while an in-flight filesystem operation may still finish.
				// Checking signal.aborted after each await observes the same aborts while
				// keeping the queue locked until the current operation has settled.
				const throwIfAborted = (): void => {
					if (signal?.aborted) throw new Error("Operation aborted");
				};

				throwIfAborted();
				// Create parent directories if needed.
				await ops.mkdir(dir);
				throwIfAborted();

				// Write the file contents.
				await ops.writeFile(absolutePath, content);
				throwIfAborted();

				return {
					content: [{ type: "text", text: `Successfully wrote ${content.length} bytes to ${path}` }],
					details: undefined,
				};
			});
		},
		renderCall(args, theme, context) {
			const renderArgs = args as { path?: string; file_path?: string; content?: string } | undefined;
			const component =
				(context.lastComponent as WriteCallRenderComponent | undefined) ?? new WriteCallRenderComponent();
			const status: WriteRenderStatus = context.isError ? "error" : context.isPartial ? "pending" : "success";
			return buildWriteCallComponent(component, renderArgs, context.expanded, status, theme, context.cwd);
		},
		renderResult(result, _options, theme, context) {
			const output = formatWriteResult({ ...result, isError: context.isError }, theme);
			const component = (context.lastComponent as Container | undefined) ?? new Container();
			component.clear();
			if (!output) return component;
			component.addChild(new Spacer(1));
			component.addChild(new Text(output, 1, 0));
			return component;
		},
	};
}

export function createWriteTool(cwd: string, options?: WriteToolOptions): AgentTool<typeof writeSchema> {
	return wrapToolDefinition(createWriteToolDefinition(cwd, options));
}
