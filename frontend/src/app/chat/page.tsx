"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  ChatMessageData,
  createChatSession,
  deleteChatSession,
  getChatMessages,
  getToken,
  listChatSessions,
  updateChatSession,
} from "@/lib/api";
import { AGENT_COLORS, connectChatWs, sendChatMessage, WsMessage } from "@/lib/ws";

type ChatItem = {
  role: "user" | "assistant";
  content: string;
  agents?: string[];
};

type SessionItem = {
  id: string;
  title: string;
};

const DEFAULT_TITLE = "新对话";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [connected, setConnected] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [routeTrail, setRouteTrail] = useState<string[]>([]);
  const [activeAgent, setActiveAgent] = useState("");
  const [toolStatus, setToolStatus] = useState("");

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, routeTrail, toolStatus]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }
    loadSessions();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (connected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [connected, activeSessionId]);

  async function loadSessions() {
    setLoadingSessions(true);
    try {
      const list = await listChatSessions();
      setSessions(list);
      if (list.length > 0) {
        await selectSession(list[0].id, list);
      } else {
        await createNewSession();
      }
    } catch {
      window.location.href = "/login";
    } finally {
      setLoadingSessions(false);
    }
  }

  async function selectSession(sessionId: string, sessionList?: SessionItem[]) {
    wsRef.current?.close();
    wsRef.current = null;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    setConnected(false);
    setMessages([]);
    setStreaming("");
    setActiveSessionId(sessionId);
    setSidebarOpen(false);
    setEditingSessionId(null);

    try {
      const msgs = await getChatMessages(sessionId);
      setMessages(
        msgs.map((m: ChatMessageData) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          agents: m.tool_calls?.route_trail as string[] | undefined,
        }))
      );
    } catch {
      // ignore
    }
    connectSessionWs(sessionId);
  }

  async function createNewSession() {
    try {
      const session = await createChatSession();
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      setMessages([]);
      setStreaming("");
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      connectSessionWs(session.id);
    } catch {
      // ignore
    }
  }

  async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("确定删除此对话？所有消息将永久丢失。")) return;
    try {
      await deleteChatSession(sessionId);
      const updated = sessions.filter((s) => s.id !== sessionId);
      setSessions(updated);
      if (sessionId === activeSessionId) {
        wsRef.current?.close();
        wsRef.current = null;
        setConnected(false);
        if (updated.length > 0) {
          await selectSession(updated[0].id, updated);
        } else {
          await createNewSession();
        }
      }
    } catch {
      // ignore
    }
  }

  function handleStartRename(sessionId: string, currentTitle: string, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditTitle(currentTitle);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }

  async function handleFinishRename(sessionId: string) {
    const newTitle = editTitle.trim();
    setEditingSessionId(null);
    if (!newTitle || newTitle === sessions.find((s) => s.id === sessionId)?.title) return;
    try {
      await updateChatSession(sessionId, newTitle);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
      );
    } catch {
      // ignore
    }
  }

  function connectSessionWs(sessionId: string) {
    const token = getToken();
    if (!token) return;

    const ws = connectChatWs(sessionId, token, handleWsMessage, () => {
      setConnected(false);
      scheduleReconnect(sessionId);
    });
    ws.onopen = () => setConnected(true);
    wsRef.current = ws;
  }

  function scheduleReconnect(sessionId: string) {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        connectSessionWs(sessionId);
      }
    }, 3000);
  }

  function handleWsMessage(msg: WsMessage) {
    switch (msg.type) {
      case "title_update":
        setSessions((prev) =>
          prev.map((s) => (s.id === activeSessionId ? { ...s, title: msg.title } : s))
        );
        break;
      case "route":
        trailRef.current = msg.trail;
        setRouteTrail([...msg.trail]);
        setActiveAgent(msg.agent);
        setIsThinking(true);
        break;
      case "agent_stream":
        setActiveAgent(msg.agent);
        break;
      case "token":
        setIsThinking(false);
        setStreaming((prev) => prev + msg.content);
        break;
      case "tool_start":
        setToolStatus(`调用 ${msg.tool}`);
        break;
      case "tool_end":
        setToolStatus("");
        break;
      case "error":
        setIsThinking(false);
        setToolStatus("");
        setStreaming((prev) => prev + `\n\n[错误] ${msg.content}`);
        break;
      case "done": {
        const agents = msg.route_trail ?? [...trailRef.current];
        setStreaming((prev) => {
          if (prev) {
            const newMsg: ChatItem = { role: "assistant", content: prev, agents };
            setMessages((m) => [...m, newMsg]);
            listChatSessions().then(setSessions).catch(() => {});
          }
          return "";
        });
        setIsThinking(false);
        setRouteTrail([]);
        setActiveAgent("");
        setToolStatus("");
        trailRef.current = [];
        break;
      }
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || isThinking)
      return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setStreaming("");
    setRouteTrail([]);
    trailRef.current = [];
    setIsThinking(true);
    sendChatMessage(wsRef.current, text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  return (
    <AppShell>
      <div className="flex flex-1 h-screen overflow-hidden">
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={selectSession}
          onNew={createNewSession}
          onDelete={handleDeleteSession}
          onStartRename={handleStartRename}
          onFinishRename={handleFinishRename}
          editingSessionId={editingSessionId}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editInputRef={editInputRef}
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-xl">
            <div className="flex items-center gap-3 min-w-0">
              <button
                className="md:hidden text-zinc-400 hover:text-zinc-200 text-lg flex-shrink-0"
                onClick={() => setSidebarOpen(true)}
              >
                ☰
              </button>
              <div className="min-w-0">
                <h1 className="text-sm font-medium text-zinc-200 truncate">
                  {activeSessionId
                    ? sessions.find((s) => s.id === activeSessionId)?.title || "对话"
                    : "选择或创建对话"}
                </h1>
                <p className="text-xs text-zinc-600 mt-0.5">
                  LangGraph Supervisor 多 Agent 协作
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "bg-emerald-400 animate-pulse-dot" : "bg-zinc-600"
                }`}
              />
              <span className="text-xs text-zinc-500">
                {connected ? "已连接" : isThinking ? "处理中" : "连接中"}
              </span>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Empty state */}
              {messages.length === 0 && !streaming && !isThinking && !loadingSessions && (
                <div className="text-center py-20 animate-fade-in">
                  <div className="text-4xl mb-4 opacity-30">◎</div>
                  <p className="text-zinc-600 text-sm mb-6">
                    向 Agent 提问，Supervisor 将自动路由到最合适的 Worker
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {[
                      "查询知识库中的政策文档",
                      "分析销售 Excel 数据",
                      "北京今天天气怎么样",
                      "用 SQL 查询用户数据",
                    ].map((hint) => (
                      <button
                        key={hint}
                        type="button"
                        onClick={() => setInput(hint)}
                        className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] text-zinc-500 hover:text-zinc-300 hover:border-[var(--border-hover)] transition-colors"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {loadingSessions && (
                <div className="text-center py-20">
                  <div className="animate-spin h-6 w-6 border-2 border-indigo-400 border-t-transparent rounded-full mx-auto" />
                </div>
              )}

              {messages.map((m, i) => (
                <MessageBubble key={`msg-${i}`} message={m} />
              ))}

              {(isThinking || routeTrail.length > 0 || toolStatus) && (
                <RouteIndicator trail={routeTrail} active={activeAgent} tool={toolStatus} />
              )}

              {streaming && (
                <MessageBubble
                  message={{ role: "assistant", content: streaming, agents: routeTrail }}
                  streaming
                />
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <footer className="border-t border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-xl px-4 md:px-6 py-4">
            <div className="max-w-2xl mx-auto">
              <div className="glass rounded-2xl p-1.5 flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  className="flex-1 bg-transparent px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none max-h-[200px]"
                  placeholder={
                    !activeSessionId
                      ? "请先创建对话..."
                      : !connected
                        ? "连接中..."
                        : "输入消息，Enter 发送，Shift+Enter 换行"
                  }
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    autoResize(e.target);
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={!connected || isThinking || !activeSessionId}
                  rows={1}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!connected || isThinking || !input.trim() || !activeSessionId}
                  className="btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 disabled:opacity-40"
                >
                  {isThinking ? (
                    <>
                      <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full" />
                      处理中
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      发送
                    </>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-zinc-700 text-center mt-2">
                AI 回复仅供参考，请核实重要信息
              </p>
            </div>
          </footer>
        </div>
      </div>
    </AppShell>
  );
}

/* ────── 侧边栏 ────── */

function Sidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  onStartRename,
  onFinishRename,
  editingSessionId,
  editTitle,
  setEditTitle,
  editInputRef,
  open,
  onToggle,
}: {
  sessions: SessionItem[];
  activeSessionId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onStartRename: (id: string, title: string, e: React.MouseEvent) => void;
  onFinishRename: (id: string) => void;
  editingSessionId: string | null;
  editTitle: string;
  setEditTitle: (t: string) => void;
  editInputRef: React.RefObject<HTMLInputElement | null>;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={onToggle} />
      )}

      <aside
        className={`${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:relative z-40 md:z-0 inset-y-0 left-0 w-72 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col transition-transform duration-200`}
      >
        <div className="p-3 border-b border-[var(--border)]">
          <button
            type="button"
            onClick={() => {
              onNew();
              onToggle();
            }}
            className="btn-primary w-full justify-center text-sm py-2.5 rounded-xl"
          >
            + 新对话
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sessions.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-8">暂无对话记录</p>
          )}
          {sessions.map((s) => {
            const isActive = s.id === activeSessionId;
            const isEditing = s.id === editingSessionId;
            return (
              <div
                key={s.id}
                className={`group relative flex items-center rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-indigo-500/15 text-zinc-200"
                    : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/40"
                }`}
              >
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    className="flex-1 bg-zinc-800 text-zinc-100 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => onFinishRename(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onFinishRename(s.id);
                      if (e.key === "Escape") setEditTitle(sessions.find((x) => x.id === s.id)?.title || "");
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className="flex-1 text-left px-3 py-2.5 truncate"
                  >
                    {s.title}
                  </button>
                )}
                {!isEditing && (
                  <div className="flex items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => onStartRename(s.id, s.title, e)}
                      className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300"
                      title="重命名"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => onDelete(s.id, e)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-500 hover:text-red-400"
                      title="删除"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onToggle}
            className="md:hidden text-xs text-zinc-500 w-full text-center py-1 hover:text-zinc-400"
          >
            关闭侧边栏
          </button>
        </div>
      </aside>
    </>
  );
}

/* ────── 消息气泡 ────── */

function MessageBubble({
  message,
  streaming,
}: {
  message: ChatItem;
  streaming?: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-indigo-500/15 border border-indigo-500/20"
            : "glass border-[var(--border)]"
        }`}
      >
        {!isUser && message.agents && message.agents.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {message.agents.map((a) => (
              <span
                key={a}
                className={`text-[10px] px-2 py-0.5 rounded-md border ${
                  AGENT_COLORS[a] || "text-zinc-400 border-zinc-700"
                }`}
              >
                {a}
              </span>
            ))}
          </div>
        )}
        <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
          {streaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-400 animate-pulse-dot align-text-bottom" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ────── 简单 Markdown 渲染 ────── */

function MarkdownRenderer({ content }: { content: string }) {
  const html = renderSimpleMarkdown(content);
  return (
    <div
      className="prose prose-invert prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderSimpleMarkdown(text: string): string {
  let html = text
    // Code blocks (```lang ... ```)
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_, lang, code) =>
        `<pre class="bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>${escapeHtml(
          code.trim()
        )}</code></pre>`
    )
    // Inline code
    .replace(
      /`([^`]+)`/g,
      '<code class="bg-zinc-800 text-indigo-300 px-1 py-0.5 rounded text-xs">$1</code>'
    )
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-400 hover:text-indigo-300 underline">$1</a>'
    )
    // Bullet lists
    .replace(/^[\s]*[-*+][\s]+(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul class="list-disc pl-4 my-2 space-y-1">$&</ul>')
    // Numbered lists
    .replace(/^[\s]*\d+\.[\s]+(.+)$/gm, "<li>$1</li>")
    // Headers
    .replace(/^### (.+)$/gm, "<h3 class='text-base font-semibold mt-4 mb-2'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-lg font-semibold mt-4 mb-2'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class='text-xl font-semibold mt-4 mb-2'>$1</h1>")
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-zinc-600 pl-3 my-2 text-zinc-400">$1</blockquote>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, "</p><p class='my-2'>")
    // Single newlines within paragraphs
    .replace(/\n/g, "<br/>");

  // Wrap consecutive non-block elements in paragraphs
  const blockTags =
    /^<\/?(pre|ul|ol|li|h[1-3]|blockquote|table|div|p)/;
  const parts = html.split(/(?=<\/?(?:pre|ul|ol|li|h[1-3]|blockquote|table|div|p))/);
  html = parts
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return "";
      if (blockTags.test(trimmed)) return trimmed;
      return `<p class="my-2">${trimmed}</p>`;
    })
    .join("");

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ────── 路由指示器 ────── */

function RouteIndicator({
  trail,
  active,
  tool,
}: {
  trail: string[];
  active: string;
  tool: string;
}) {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="glass rounded-2xl px-4 py-3 border border-[var(--border)]">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse-dot" />
          <span className="text-xs text-zinc-500">Supervisor 路由中</span>
        </div>
        {trail.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {trail.map((a, i) => (
              <span key={`${a}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-zinc-700 text-xs">→</span>}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-md border ${
                    a === active
                      ? AGENT_COLORS[a]
                      : "text-zinc-600 border-zinc-800"
                  }`}
                >
                  {a}
                </span>
              </span>
            ))}
          </div>
        )}
        {tool ? <p className="text-xs text-amber-400/80 mt-2">{tool}</p> : null}
      </div>
    </div>
  );
}
