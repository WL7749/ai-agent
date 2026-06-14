"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import {
  createKnowledgeBase,
  getToken,
  listDocuments,
  listKnowledgeBases,
  uploadDocument,
} from "@/lib/api";

const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "等待索引", color: "text-zinc-500" },
  processing: { label: "索引中", color: "text-amber-400" },
  indexed: { label: "已就绪", color: "text-emerald-400" },
  failed: { label: "失败", color: "text-red-400" },
};

export default function KnowledgePage() {
  const [bases, setBases] = useState<{ id: string; name: string; description: string | null }[]>(
    []
  );
  const [docs, setDocs] = useState<{ id: string; filename: string; status: string; kb_id: string }[]>(
    []
  );
  const [newKbName, setNewKbName] = useState("");
  const [selectedKb, setSelectedKb] = useState("");
  const [toast, setToast] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const [b, d] = await Promise.all([listKnowledgeBases(), listDocuments()]);
    setBases(b);
    setDocs(d);
    if (b.length && !selectedKb) setSelectedKb(b[0].id);
  }

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    refresh().catch(() => {
      window.location.href = "/login";
    });
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function handleCreateKb(e: FormEvent) {
    e.preventDefault();
    if (!newKbName.trim()) return;
    await createKnowledgeBase(newKbName.trim());
    setNewKbName("");
    await refresh();
    setToast("知识库已创建");
  }

  async function handleUpload(file: File) {
    if (!selectedKb) {
      setToast("请先创建知识库");
      return;
    }
    await uploadDocument(selectedKb, file);
    await refresh();
    setToast(`${file.name} 已上传，后台索引中`);
  }

  return (
    <AppShell>
      <div className="flex-1 p-8 max-w-3xl">
        <header className="mb-8 animate-fade-in">
          <p className="text-xs text-zinc-500 mb-1">Knowledge Base</p>
          <h1 className="text-2xl font-semibold tracking-tight">知识库</h1>
          <p className="text-sm text-zinc-500 mt-1">上传文档，Agent 将通过 RAG 语义检索引用</p>
        </header>

        {toast && (
          <div className="mb-6 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 animate-fade-in">
            {toast}
          </div>
        )}

        <section className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">新建知识库</h2>
          <form onSubmit={handleCreateKb} className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="例：HR 员工手册"
              value={newKbName}
              onChange={(e) => setNewKbName(e.target.value)}
            />
            <button type="submit" className="btn-primary shrink-0">
              创建
            </button>
          </form>
        </section>

        <section className="glass rounded-2xl p-6 mb-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">上传文档</h2>
          {bases.length === 0 ? (
            <p className="text-sm text-zinc-600">请先创建一个知识库</p>
          ) : (
            <>
              <select
                className="input-field mb-4 max-w-xs"
                value={selectedKb}
                onChange={(e) => setSelectedKb(e.target.value)}
              >
                {bases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div
                className="border border-dashed border-[var(--border)] rounded-xl p-8 text-center hover:border-[var(--border-hover)] transition-colors cursor-pointer"
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                role="button"
                tabIndex={0}
              >
                <p className="text-sm text-zinc-400 mb-1">点击或拖拽上传</p>
                <p className="text-xs text-zinc-600">PDF · Word · TXT</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </>
          )}
        </section>

        <section className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-zinc-300">文档</h2>
            <span className="text-xs text-zinc-600">{docs.length} 个文件</span>
          </div>
          {docs.length === 0 ? (
            <p className="text-sm text-zinc-600 py-8 text-center">暂无文档</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {docs.map((d) => {
                const st = STATUS[d.status] || STATUS.pending;
                return (
                  <li key={d.id} className="flex items-center justify-between py-3.5 first:pt-0">
                    <span className="text-sm text-zinc-300 truncate max-w-[70%]">{d.filename}</span>
                    <span className={`text-xs ${st.color}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
