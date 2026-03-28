// Author: be-domain-modeler
import * as fs from 'node:fs';
import * as https from 'node:https';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractLogEvidence, extractStateEvidence, type LiveAcceptanceStateEvidence } from '../bridge/live-acceptance';
import type { BridgeDurableState } from '../bridge/types';

const DEFAULT_DOMAIN = 'agchorus.com';
const DEFAULT_TIMEOUT_SECONDS = 90;
const DEFAULT_POLL_INTERVAL_MS = 1000;
const CARD = {
  card_version: '0.3',
  user_culture: 'en',
  supported_languages: ['en'],
};

interface RegisterResponse {
  readonly code: number;
  readonly data?: {
    readonly api_key?: string;
  };
}

interface SendResponse {
  readonly code: number;
  readonly data?: {
    readonly delivery?: string;
    readonly trace_id?: string;
  };
  readonly message?: string;
}

interface CliOptions {
  readonly receiverId: string;
  readonly domain: string;
  readonly stateFile: string;
  readonly gatewayLog: string;
  readonly timeoutMs: number;
}

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  const stamp = startedAt.toString();
  const senderId = `bridge-live-probe-${stamp}@chorus`;
  const originalText = `bridge-live-probe-${stamp}`;
  const baseUrl = `https://${options.domain}`;

  const senderRegistration = await registerAgent(baseUrl, senderId);
  const senderKey = senderRegistration.data?.api_key ?? '';
  if (!senderKey) {
    fail(`register sender failed receiver=${options.receiverId} domain=${options.domain}`);
  }

  const sendResponse = await postJson<SendResponse>(
    `${baseUrl}/messages`,
    {
      receiver_id: options.receiverId,
      envelope: {
        chorus_version: '0.4',
        sender_id: senderId,
        original_text: originalText,
        sender_culture: 'en',
      },
    },
    { Authorization: `Bearer ${senderKey}` },
  );

  const delivery = sendResponse.data?.delivery ?? 'missing';
  const inboundTraceId = sendResponse.data?.trace_id ?? '';
  if (delivery !== 'delivered_sse' || !inboundTraceId) {
    fail(`FAIL gate=hub receiver=${options.receiverId} delivery=${delivery} trace_id=${inboundTraceId || 'missing'}`);
  }

  const evidence = await waitForStateAndLogs(options, inboundTraceId);
  const elapsedMs = Date.now() - startedAt;
  const deliveryMode = evidence.state.deliveryEvidence?.method
    ?? evidence.state.terminalDisposition?.reason
    ?? 'unknown';

  console.log([
    'PASS',
    `receiver=${options.receiverId}`,
    `delivery=${delivery}`,
    `inbound_trace_id=${inboundTraceId}`,
    `route_key=${evidence.state.routeKey}`,
    `relay_trace_id=${evidence.state.relayTraceId ?? 'missing'}`,
    `disposition=${deliveryMode}`,
    `log_method=${evidence.log.deliveryMethod ?? 'missing'}`,
    `elapsed_ms=${elapsedMs}`,
  ].join(' '));
  console.log(JSON.stringify({
    domain: options.domain,
    receiver_id: options.receiverId,
    state_file: options.stateFile,
    gateway_log: options.gatewayLog,
    inbound_trace_id: inboundTraceId,
    relay_trace_id: evidence.state.relayTraceId,
    route_key: evidence.state.routeKey,
    cursor_advanced: evidence.state.cursorAdvanced,
    relay_confirmed: evidence.state.relayConfirmed,
    terminal_disposition: evidence.state.terminalDisposition?.reason ?? null,
    delivery_method: evidence.log.deliveryMethod,
  }, null, 2));
};

const waitForStateAndLogs = async (
  options: CliOptions,
  inboundTraceId: string,
): Promise<{
  readonly state: LiveAcceptanceStateEvidence;
  readonly log: ReturnType<typeof extractLogEvidence>;
}> => {
  const deadline = Date.now() + options.timeoutMs;

  const pollOnce = (state: LiveAcceptanceStateEvidence | null): string | null => {
    if (!state) return `state missing trace_id=${inboundTraceId}`;
    if (!state.cursorAdvanced) return `state cursor not advanced trace_id=${inboundTraceId}`;
    if (!state.deliveryEvidence && !state.terminalDisposition) return `state terminal evidence missing trace_id=${inboundTraceId}`;
    if (!state.relayConfirmed || !state.relayTraceId) return `state relay evidence missing trace_id=${inboundTraceId}`;
    const logText = safeReadFile(options.gatewayLog);
    const logEvidence = extractLogEvidence(logText, inboundTraceId, state.routeKey, state.relayTraceId);
    if (!logEvidence.deliveryLogFound) return `gateway log missing delivery trace_id=${inboundTraceId}`;
    if (!logEvidence.relayLogFound) return `gateway log missing relay trace_id=${state.relayTraceId}`;
    return null; // all checks passed
  };

  const pollLoop = async (): Promise<{
    readonly state: LiveAcceptanceStateEvidence;
    readonly log: ReturnType<typeof extractLogEvidence>;
  }> => {
    const problem = pollOnce(loadStateEvidence(options.stateFile, inboundTraceId));
    if (problem === null) {
      const state = loadStateEvidence(options.stateFile, inboundTraceId)!;
      const logText = safeReadFile(options.gatewayLog);
      return { state, log: extractLogEvidence(logText, inboundTraceId, state.routeKey, state.relayTraceId) };
    }
    if (Date.now() > deadline) {
      throw new Error(`FAIL gate=bridge receiver=${options.receiverId} trace_id=${inboundTraceId} reason=${problem}`);
    }
    await sleep(DEFAULT_POLL_INTERVAL_MS);
    return pollLoop();
  };

  return pollLoop();
};

const loadStateEvidence = (
  stateFile: string,
  inboundTraceId: string,
): LiveAcceptanceStateEvidence | null => {
  if (!fs.existsSync(stateFile)) {
    return null;
  }

  const raw = safeReadFile(stateFile);
  if (!raw) {
    return null;
  }

  try {
    const state = JSON.parse(raw) as BridgeDurableState;
    return extractStateEvidence(state, inboundTraceId);
  } catch {
    return null;
  }
};

const registerAgent = async (baseUrl: string, agentId: string): Promise<RegisterResponse> =>
  postJson<RegisterResponse>(`${baseUrl}/register`, {
    agent_id: agentId,
    agent_card: CARD,
  });

const postJson = async <T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<T> => {
  const payload = JSON.stringify(body);
  return new Promise<T>((resolve, reject) => {
    const request = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload).toString(),
        ...headers,
      },
    }, (response) => {
      const chunks: string[] = [];
      response.setEncoding('utf8');
      response.on('data', (chunk) => { chunks.push(chunk); });
      response.on('end', () => {
        const raw = chunks.join('');
        if (!raw) {
          reject(new Error(`Empty response from ${url}`));
          return;
        }

        try {
          resolve(JSON.parse(raw) as T);
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${String(error)}`));
        }
      });
    });

    request.on('error', reject);
    request.write(payload);
    request.end();
  });
};

const parseArgs = (argv: string[]): CliOptions => {
  const receiverId = argv[0];
  if (!receiverId || receiverId.startsWith('-')) {
    printUsageAndExit();
  }

  const domain = argv[1] ?? process.env.CHORUS_HUB_DOMAIN ?? DEFAULT_DOMAIN;
  const stateFile = process.env.CHORUS_STATE_FILE ?? deriveStateFile(receiverId);
  const gatewayLog = process.env.OPENCLAW_GATEWAY_LOG ?? path.join(os.homedir(), '.openclaw', 'logs', 'gateway.log');
  const timeoutSeconds = Number(process.env.BRIDGE_LIVE_TIMEOUT_SECONDS ?? DEFAULT_TIMEOUT_SECONDS);

  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    fail(`invalid timeout seconds: ${String(process.env.BRIDGE_LIVE_TIMEOUT_SECONDS ?? DEFAULT_TIMEOUT_SECONDS)}`);
  }

  return {
    receiverId,
    domain,
    stateFile,
    gatewayLog,
    timeoutMs: timeoutSeconds * 1000,
  };
};

const deriveStateFile = (receiverId: string): string => {
  const localName = receiverId.split('@')[0];
  return path.join(os.homedir(), '.chorus', 'state', localName, `${receiverId}.json`);
};

const safeReadFile = (filePath: string): string => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
};

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const printUsageAndExit = (): never => {
  console.error('Usage: ./bin/probe-bridge-live.sh <receiver-agent-id> [domain]');
  console.error('Env overrides: CHORUS_STATE_FILE, OPENCLAW_GATEWAY_LOG, BRIDGE_LIVE_TIMEOUT_SECONDS');
  process.exit(1);
};

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

void main().catch((error) => {
  const rendered = error instanceof Error ? error.message : String(error);
  fail(`FAIL gate=runtime reason=${rendered}`);
});
