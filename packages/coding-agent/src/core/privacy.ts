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
export const ZDR_EXPORT_DISABLED_MESSAGE = "Session export is disabled in ZDR mode.";

export function mergePrivacyMode(privacy: Partial<PrivacyMode> | undefined): PrivacyMode {
	return {
		clientZdr: privacy?.clientZdr ?? false,
		remoteZdr: privacy?.remoteZdr ?? false,
	};
}
