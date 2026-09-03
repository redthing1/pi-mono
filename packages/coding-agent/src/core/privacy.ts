export interface PrivacyMode {
	clientZdr: boolean;
	remoteZdr: boolean;
}

export const DEFAULT_PRIVACY_MODE: PrivacyMode = {
	clientZdr: false,
	remoteZdr: false,
};

export const ZDR_MODEL_REQUIRED_MESSAGE = 'ZDR requires a model marked "zdr": true.';
export const ZDR_MODEL_UNAVAILABLE_MESSAGE = "No ZDR-approved model is available.";
export const ZDR_EXPORT_PATH_REQUIRED_MESSAGE = "Client ZDR export requires an explicit output path.";
export const ZDR_SESSION_ACCESS_DISABLED_MESSAGE = "Session switching is disabled in client ZDR mode.";
export const ZDR_SESSION_LIST_DISABLED_MESSAGE = "Session listing is disabled in client ZDR mode.";

export function mergePrivacyMode(privacy: Partial<PrivacyMode> | undefined): PrivacyMode {
	return {
		clientZdr: privacy?.clientZdr ?? false,
		remoteZdr: privacy?.remoteZdr ?? false,
	};
}
