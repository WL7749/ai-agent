"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearToken } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "概览", icon: "◈" },
  { href: "/chat", label: "对话", icon: "◎" },
  { href: "/knowledge", label: "知识库", icon: "▤" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex w-60 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
        <div className="px-5 py-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 text-sm font-bold">
              A
            </span>
            <span className="text-sm font-semibold tracking-tight">Agent Platform</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
              >
                <span className="text-base opacity-60">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => {
              clearToken();
              window.location.href = "/login";
            }}
            className="nav-link w-full text-left text-zinc-500 hover:text-red-400"
          >
            <span className="text-base opacity-60">⏻</span>
            退出登录
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl flex justify-around py-2 z-50">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 text-[10px] ${
                active ? "text-white" : "text-zinc-500"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
