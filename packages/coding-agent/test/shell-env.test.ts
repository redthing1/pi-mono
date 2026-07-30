import { afterEach, describe, expect, it } from "vitest";
import { getShellEnv } from "../src/utils/shell.ts";

const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH";
const originalPath = process.env[pathKey];

afterEach(() => {
	if (originalPath === undefined) {
		delete process.env[pathKey];
	} else {
		process.env[pathKey] = originalPath;
	}
});

describe("shell environment", () => {
	it("does not prepend an application-managed binary directory", () => {
		process.env[pathKey] = "/usr/local/bin:/usr/bin";

		expect(getShellEnv()[pathKey]).toBe("/usr/local/bin:/usr/bin");
	});
});
