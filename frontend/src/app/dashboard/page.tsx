"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getMe, getToken, listChatSessions, listDocuments, listKnowledgeBases } from "@/lib/api";

export default function DashboardPage() {
  const [user, setUser] = useState<{ email: string; full_name: string | null } | null>(null);
  const [stats, setStats] = useState({ sessions: 0, bases: 0, docs: 0 });

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    Promise.all([getMe(), listChatSessions(), listKnowledgeBases(), listDocuments()])
      .then(([me, sessions, bases, docs]) => {
        setUser(me);
        setStats({ sessions: sessions.length, bases: bases.length, docs: docs.length });
      })
      .catch(() => {
        window.location.href = "/login";
      });
  }, []);

  const cards = [
    { label: "对话会话", value: stats.sessions, href: "/chat" },
    { label: "知识库", value: stats.bases, href: "/knowledge" },
    { label: "已上传文档", value: stats.docs, href: "/knowledge" },
  ];

  return (
    <AppShell>
      <div className="flex-1 p-8 max-w-4xl">
        <header className="mb-10 animate-fade-in">
          <p className="text-xs text-zinc-500 mb-1">工作台</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user?.full_name || user?.email?.split("@")[0] || "..."}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">{user?.email}</p>
        </header>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {cards.map((c) => (
            <Link
              key={c.label}
              href={c.href}
              className="glass rounded-2xl p-5 hover:border-[var(--border-hover)] transition-all group"
            >
              <p className="text-xs text-zinc-500 mb-2">{c.label}</p>
              <p className="text-3xl font-semibold text-zinc-100 group-hover:text-white transition-colors">
                {c.value}
              </p>
            </Link>
          ))}
        </div>

        <section className="glass rounded-2xl p-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">快速开始</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Link href="/chat" className="btn-primary justify-center">
              开始 AI 对话
            </Link>
            <Link href="/knowledge" className="btn-ghost justify-center">
              管理知识库
            </Link>
          </div>
        </section>

        <section className="mt-8 glass rounded-2xl p-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-3">Agent 架构</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Supervisor 根据问题意图路由至 Research（知识检索）、Data（数据分析）或 General（通用）Agent，
            支持多步协作与最终答复合成。
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {["Supervisor", "Research", "Data", "General", "Synthesizer"].map((a) => (
              <span
                key={a}
                className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-zinc-400"
              >
                {a}
              </span>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
