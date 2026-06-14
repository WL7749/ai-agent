import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen mesh-bg">
      <header className="flex items-center justify-between px-8 py-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 text-sm font-bold">
            A
          </span>
          <span className="text-sm font-semibold tracking-tight text-zinc-200">Agent Platform</span>
        </div>
        <Link href="/login" className="btn-ghost text-xs">
          登录
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-8 pt-16 pb-24">
        <section className="max-w-2xl animate-fade-in">
          <p className="text-xs font-medium tracking-widest uppercase text-indigo-400/80 mb-6">
            Enterprise AI · LangGraph
          </p>
          <h1 className="text-5xl md:text-6xl font-semibold leading-[1.1] tracking-tight text-gradient mb-6">
            多 Agent 协作的
            <br />
            企业智能平台
          </h1>
          <p className="text-lg text-zinc-500 leading-relaxed mb-10 max-w-lg">
            Supervisor 智能路由 · RAG 知识库 · Tool Calling · 流式对话。
            为团队打造的下一代 AI 工作流。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className="btn-primary">
              开始使用
            </Link>
            <Link href="/chat" className="btn-ghost">
              体验对话
            </Link>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4 mt-24 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          {[
            { title: "Supervisor 路由", desc: "LangGraph 多 Agent 智能调度与结果合成" },
            { title: "RAG 知识库", desc: "PDF / Word 文档语义检索与引用溯源" },
            { title: "Tool Calling", desc: "数据库、Excel、天气 API 等外部工具" },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 hover:border-[var(--border-hover)] transition-colors">
              <h3 className="text-sm font-medium text-zinc-200 mb-2">{f.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-8 text-center text-xs text-zinc-600">
        FastAPI · LangGraph · DeepSeek · Next.js
      </footer>
    </div>
  );
}
