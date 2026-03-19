// Author: be-domain-modeler

interface AgentConfig {
  readonly culture: string;
  readonly port: number;
  readonly routerUrl: string;
  readonly agentId: string;
  readonly languages: readonly string[];
  readonly personality?: string;
}

interface SendResult {
  readonly adaptedText: string;
  readonly envelope: import("../shared/types").ChorusEnvelope;
}

interface AgentHandle {
  readonly shutdown: () => Promise<void>;
  readonly sendMessage: (targetId: string, text: string) => Promise<SendResult>;
}

const parseArgs = (args: readonly string[]): AgentConfig => {
  const flagValue = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };

  const culture = flagValue("--culture");
  if (culture === undefined) {
    throw new Error("--culture is required");
  }

  const port = Number(flagValue("--port") ?? "3001");
  const routerUrl = flagValue("--router") ?? "http://localhost:3000";
  const agentId = flagValue("--agent-id") ?? `agent-${culture}-${port}`;
  const languagesRaw = flagValue("--languages");
  const languages = languagesRaw ? languagesRaw.split(",") : [culture];
  const personality = flagValue("--personality");

  return { culture, port, routerUrl, agentId, languages, personality };
};

const validateEnv = (): { readonly apiKey: string } => {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    throw new Error("DASHSCOPE_API_KEY is required");
  }
  return { apiKey };
};

export { parseArgs, validateEnv };
export type { AgentConfig, AgentHandle, SendResult };
