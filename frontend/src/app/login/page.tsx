"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { login, register } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register({ email, password, full_name: fullName, tenant_name: tenantName });
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen mesh-bg flex">
      <div className="hidden lg:flex flex-1 items-center justify-center p-12">
        <div className="max-w-md">
          <p className="text-xs font-medium tracking-widest uppercase text-indigo-400/80 mb-4">
            Enterprise AI
          </p>
          <h2 className="text-3xl font-semibold text-gradient leading-tight mb-4">
            登录你的
            <br />
            Agent 工作空间
          </h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            多租户 RBAC · LangGraph 多 Agent · DeepSeek 驱动
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="glass-elevated rounded-2xl p-8">
            <div className="mb-8">
              <h1 className="text-xl font-semibold text-zinc-100">
                {mode === "login" ? "欢迎回来" : "创建账户"}
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                {mode === "login" ? "登录以继续" : "注册企业与管理员账户"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <>
                  <input
                    className="input-field"
                    placeholder="企业 / 团队名称"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    required
                  />
                  <input
                    className="input-field"
                    placeholder="姓名（可选）"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </>
              )}
              <input
                type="email"
                className="input-field"
                placeholder="工作邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                className="input-field"
                placeholder="密码（至少 6 位）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              {error && (
                <p className="text-sm text-red-400/90 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "注册新账户" : "已有账户？登录"}
              </button>
              <Link href="/" className="text-zinc-600 hover:text-zinc-400 transition-colors">
                首页
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
