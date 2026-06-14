const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "请求失败");
  }
  return res.json();
}

export async function register(data: {
  email: string;
  password: string;
  full_name?: string;
  tenant_name: string;
}) {
  const result = await apiFetch<{ access_token: string }>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
  setToken(result.access_token);
  return result;
}

export async function login(email: string, password: string) {
  const result = await apiFetch<{ access_token: string }>("/api/v1/auth/login/json", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(result.access_token);
  return result;
}

export async function getMe() {
  return apiFetch<{ id: string; email: string; full_name: string | null; tenant_id: string }>(
    "/api/v1/auth/me"
  );
}

export async function listChatSessions() {
  return apiFetch<{ id: string; title: string }[]>("/api/v1/chat/sessions");
}

export async function createChatSession(title = "新对话") {
  return apiFetch<{ id: string; title: string }>("/api/v1/chat/sessions", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function updateChatSession(sessionId: string, title: string) {
  return apiFetch<{ id: string; title: string }>(`/api/v1/chat/sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteChatSession(sessionId: string) {
  return apiFetch<{ ok: boolean }>(`/api/v1/chat/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

export interface ChatMessageData {
  id: string;
  role: string;
  content: string;
  tool_calls?: Record<string, unknown> | null;
  created_at?: string | null;
}

export async function getChatMessages(sessionId: string) {
  return apiFetch<ChatMessageData[]>(`/api/v1/chat/sessions/${sessionId}/messages`);
}

export async function listKnowledgeBases() {
  return apiFetch<{ id: string; name: string; description: string | null }[]>(
    "/api/v1/knowledge/bases"
  );
}

export async function createKnowledgeBase(name: string, description?: string) {
  return apiFetch<{ id: string; name: string }>("/api/v1/knowledge/bases", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export async function uploadDocument(kbId: string, file: File) {
  const form = new FormData();
  form.append("kb_id", kbId);
  form.append("file", file);
  return apiFetch<{ id: string; filename: string; status: string }>(
    "/api/v1/knowledge/documents/upload",
    { method: "POST", body: form }
  );
}

export async function listDocuments() {
  return apiFetch<{ id: string; filename: string; status: string; kb_id: string }[]>(
    "/api/v1/knowledge/documents"
  );
}
