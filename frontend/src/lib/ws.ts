export type WsMessage =
  | { type: "token"; content: string }
  | { type: "route"; agent: string; label: string; trail: string[] }
  | { type: "agent_stream"; agent: string; label: string }
  | { type: "tool_start"; tool: string; input: unknown }
  | { type: "tool_end"; tool: string; output: string }
  | { type: "title_update"; title: string }
  | { type: "error"; content: string }
  | { type: "done"; route_trail?: string[] };

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function connectChatWs(
  sessionId: string,
  token: string,
  onMessage: (msg: WsMessage) => void,
  onError?: (err: Event) => void
): WebSocket {
  const ws = new WebSocket(`${WS_URL}/api/v1/ws/chat/${sessionId}?token=${encodeURIComponent(token)}`);

  ws.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      /* ignore */
    }
  };

  ws.onerror = (e) => onError?.(e);
  return ws;
}

export function sendChatMessage(ws: WebSocket, message: string) {
  ws.send(JSON.stringify({ message }));
}

export const AGENT_COLORS: Record<string, string> = {
  research: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  data: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  general: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  synthesizer: "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

export const AGENT_LABELS: Record<string, string> = {
  research: "Research",
  data: "Data",
  general: "General",
  synthesizer: "Synthesizer",
};
