import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Platform · 企业 AI 工作平台",
  description: "基于 LangGraph + DeepSeek 的多 Agent 企业协作平台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
