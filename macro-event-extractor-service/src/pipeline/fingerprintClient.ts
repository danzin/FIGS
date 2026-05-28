import crypto from "crypto";
import { MacroEvent } from "@financialsignalsgatheringsystem/common";

function embeddingFingerprint(input: string): string {
	return crypto.createHash("sha256").update(input).digest("hex");
}

export async function enrichWithEmbeddingMetadata(
	event: MacroEvent,
	model: string
): Promise<MacroEvent> {
	const fingerprintInput = `${event.event_type}|${event.channel}|${event.canonical_text}|${event.event_time.toISOString()}`;
	const fingerprint = embeddingFingerprint(fingerprintInput);

	return {
		...event,
		metadata: {
			...(event.metadata || {}),
			embedding_model: model,
			embedding_fingerprint: fingerprint,
			embedding_requested_at: new Date().toISOString(),
		},
	};
}

