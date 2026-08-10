import { type PrivacyMode, ZDR_SESSION_LIST_DISABLED_MESSAGE } from "../../core/privacy.ts";
import { SessionManager } from "../../core/session-manager.ts";
import type { RpcSessionSummary } from "./rpc-types.ts";

interface RpcSessionSource {
	privacy: PrivacyMode;
	sessionManager: Pick<SessionManager, "getCwd" | "getSessionDir">;
}

/** List the current runtime's session group without exposing full transcript text. */
export async function listRpcSessions(session: RpcSessionSource): Promise<RpcSessionSummary[]> {
	if (session.privacy.clientZdr) {
		throw new Error(ZDR_SESSION_LIST_DISABLED_MESSAGE);
	}

	const manager = session.sessionManager;
	const sessions = await SessionManager.list(manager.getCwd(), manager.getSessionDir());
	return sessions.map((item) => ({
		id: item.id,
		path: item.path,
		name: item.name,
		created: item.created.toISOString(),
		modified: item.modified.toISOString(),
		messageCount: item.messageCount,
		firstMessage: item.firstMessage,
	}));
}
