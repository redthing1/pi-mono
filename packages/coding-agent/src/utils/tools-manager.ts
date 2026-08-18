import { spawnSync } from "node:child_process";

interface ToolConfig {
	name: string;
	binaryName: string;
	systemBinaryNames?: string[];
}

const TOOLS: Record<"fd" | "rg", ToolConfig> = {
	fd: {
		name: "fd",
		binaryName: "fd",
		systemBinaryNames: ["fd", "fdfind"],
	},
	rg: {
		name: "ripgrep",
		binaryName: "rg",
	},
};

export interface ToolStatus {
	type: "info" | "warning";
	message: string;
}

function commandExists(command: string): boolean {
	try {
		const result = spawnSync(command, ["--version"], { stdio: "pipe" });
		return result.error === undefined || result.error === null;
	} catch {
		return false;
	}
}

/** Return an already installed system tool. Pi never downloads or installs tools. */
export function getToolPath(tool: "fd" | "rg"): string | null {
	const config = TOOLS[tool];
	for (const binaryName of config.systemBinaryNames ?? [config.binaryName]) {
		if (commandExists(binaryName)) {
			return binaryName;
		}
	}
	return null;
}

/**
 * Return an already installed system tool and report when it is absent.
 * Kept async because callers resolve both tools concurrently at startup.
 */
export async function ensureTool(
	tool: "fd" | "rg",
	onStatus?: (status: ToolStatus) => void,
): Promise<string | undefined> {
	const toolPath = getToolPath(tool);
	if (toolPath) return toolPath;

	onStatus?.({
		type: "warning",
		message: `${TOOLS[tool].name} not found. Install it with your system package manager and add it to PATH; Pi will not download tools automatically.`,
	});
	return undefined;
}
