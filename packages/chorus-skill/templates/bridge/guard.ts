/**
 * Chorus bridge security guards.
 * Single source of truth — imported by index.ts and tests.
 *
 * INVARIANT: Remote Chorus content enters the MESSAGE HANDLING PLANE only.
 * It MUST NOT enter the TOOL EXECUTION PLANE. These guards produce
 * machine-readable fields that downstream code can check mechanically.
 */

// --- Slash neutralization ---

/**
 * Neutralize text whose first non-whitespace character is '/' so it
 * cannot be mistaken for a local slash command by any downstream
 * dispatcher or middleware that may trimStart() before matching.
 * Original text is preserved in envelope history; only the forwarded
 * display form is modified.
 */
export function neutralizeRemoteSlash(text: string): {
  readonly text: string;
  readonly slashNeutralized: boolean;
} {
  if (typeof text === "string" && /^\s*\//.test(text)) {
    return { text: `[remote] ${text}`, slashNeutralized: true };
  }
  return { text, slashNeutralized: false };
}

// --- Trust boundary builder ---

/**
 * Build the complete trust-boundary metadata block for a chorus inbound
 * message Body. Every field here is a machine-readable guard that
 * downstream code (dispatchers, tool routers, middleware) can inspect
 * to decide what operations are permitted on this content.
 *
 * Allowed on remote_untrusted content:
 *   - display / relay to the user
 *   - translate / adapt language
 *   - send protocol-level replies (status ok, continue conversation)
 *
 * NOT allowed (requires trusted local actor to re-authorize):
 *   - execute shell / file / system / control tools
 *   - trigger destructive side effects
 *   - read local sensitive files and exfiltrate
 */
export function buildTrustBoundary(originalText: string): {
  readonly trust_level: "remote_untrusted";
  readonly allow_local_control: false;
  readonly allow_tool_execution: false;
  readonly allow_side_effects: false;
  readonly source_channel: "chorus";
  readonly _slash_neutralized: boolean;
  readonly original_text: string;
} {
  const sanitized = neutralizeRemoteSlash(originalText);
  return {
    trust_level: "remote_untrusted",
    allow_local_control: false,
    allow_tool_execution: false,
    allow_side_effects: false,
    source_channel: "chorus",
    _slash_neutralized: sanitized.slashNeutralized,
    original_text: sanitized.text,
  };
}
