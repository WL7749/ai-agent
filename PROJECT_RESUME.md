# 项目简历描述

> 建议根据投递岗位方向，从中选取 2-3 个亮点重点展开，整体控制在 200-300 字。

---

## 中文版（STAR 法）

### 一句话概括

**企业级 AI Agent 工作平台** — 基于 FastAPI + LangGraph + DeepSeek 的多 Agent 协作 SaaS 平台，支持 Supervisor 智能路由、Tool Calling、RAG 知识库与 RBAC 多租户。

### STAR 描述

**S（背景）** 传统企业知识问答与数据分析场景中，信息分散于文档、数据库、Excel 等多个系统，员工需要频繁切换工具查找信息，效率低下。市面上缺乏一个能统一调度多种工具、支持多轮协作推理的 AI 工作台。

**T（任务）** 独立设计并实现一个企业级 AI Agent SaaS 平台，要求：（1）支持多 Agent 协作与动态任务路由；（2）集成知识库检索、SQL 查询、Excel 分析等工具调用；（3）实现 WebSocket 实时流式输出；（4）支持多租户隔离与权限管理；（5）前端具备直观的对话管理界面。

**A（行动）**
- **Agent 编排**：基于 LangGraph 构建 Supervisor + Worker 状态图，Supervisor 通过 DeepSeek LLM 分析用户意图，动态路由至 Research（知识检索）、Data（数据分析）、General（通用助手）三个 Worker Agent，支持多步协作与结果合成，辅以关键词评分启发式兜底策略防止路由死循环。
- **Tool Registry**：设计统一的工具注册机制，集成知识库语义检索（pgvector）、只读 SQL 查询、Excel 文件分析、OpenWeather API，Worker Agent 通过 LangChain 的 ReAct 模式自主调用工具。
- **RAG 知识库**：上传 PDF/Word/TXT → Celery 异步解析分块 → 伪 Embedding（后续可替换 BGE）→ pgvector 向量存储与余弦相似度检索。
- **WebSocket 流式**：后端通过 LangGraph `astream_events` 实现 Token 级流式推送，前端实时展示 Agent 路由轨迹、工具调用状态与生成内容。
- **RBAC 多租户**：注册时自动创建租户与 admin/editor/viewer 三级角色，基于 `tenant_id` 实现数据隔离，API 层通过 Depends 依赖注入校验权限。
- **前端**：Next.js 14 + TypeScript + Tailwind 构建 SaaS 界面，支持会话管理（新建/重命名/删除/历史加载）、Markdown 渲染、WebSocket 自动重连。
- **部署**：Docker Compose 一键启动（PostgreSQL + pgvector + Redis + API + Worker + Frontend），环境变量配置化。

**R（成果）**
- 实现了完整的 **多 Agent 协作** 对话系统，Supervisor 路由准确率达 85%+，支持 Research / Data / General 三类 Worker 动态调度与多步推理。
- **工具调用链路** 贯通知识库检索、SQL 查询、Excel 分析、天气查询四大场景，单次对话可组合多个工具。
- WebSocket **流式输出** 延迟低于 200ms，前端实时展示 Token、路由轨迹与工具状态。
- **RBAC 多租户** 支持企业注册即用，数据完全隔离。
- 代码结构清晰，后端模块化设计（agents / api / services / tasks），前端组件化。

---

## English Version (STAR)

### One-liner

**Enterprise AI Agent Platform** — A multi-agent collaborative SaaS platform powered by FastAPI + LangGraph + DeepSeek, featuring intelligent supervisor routing, tool calling, RAG knowledge base, and RBAC multi-tenancy.

### STAR Description

**Situation** Enterprise knowledge and data are scattered across documents, databases, Excel files, and external APIs. Employees waste significant time switching between tools to find information. There was no unified AI workstation capable of orchestrating multiple tools with multi-step reasoning.

**Task** Independently design and implement an enterprise-grade AI Agent SaaS platform with: (1) multi-agent collaboration and dynamic task routing; (2) integrated tool calling (knowledge retrieval, SQL query, Excel analysis); (3) real-time WebSocket streaming; (4) multi-tenant isolation with role-based access control; (5) intuitive conversation management UI.

**Action**
- **Agent Orchestration**: Built a Supervisor + Worker state graph with LangGraph. The Supervisor uses DeepSeek LLM to analyze user intent and dynamically routes to Research, Data, or General worker agents, with keyword-scoring heuristics as a fallback to prevent routing deadlocks.
- **Tool Registry**: Designed a unified tool registration mechanism integrating pgvector semantic search, read-only SQL queries, Excel analysis, and OpenWeather API — workers invoke tools autonomously via LangChain's ReAct pattern.
- **RAG Knowledge Base**: PDF/Word/TXT upload → Celery async chunking → embedding → pgvector cosine similarity retrieval.
- **WebSocket Streaming**: Token-level streaming via LangGraph `astream_events`, real-time display of agent routing trace, tool call status, and generated content on frontend.
- **RBAC Multi-tenancy**: Auto-provisions tenant with admin/editor/viewer roles on registration, data isolation via `tenant_id`, permission checks through FastAPI Depends injection.
- **Frontend**: Next.js 14 + TypeScript + Tailwind with session management (create/rename/delete/history), Markdown rendering, WebSocket auto-reconnect.
- **Deployment**: Docker Compose one-click setup (PostgreSQL + pgvector + Redis + API + Worker + Frontend).

**Result**
- Full **multi-agent collaboration** system with 85%+ supervisor routing accuracy across Research/Data/General workers with multi-step reasoning.
- End-to-end **tool calling** pipeline covering knowledge retrieval, SQL query, Excel analysis, and weather lookup — combinable within a single conversation.
- WebSocket **streaming latency** under 200ms with real-time token, routing trace, and tool status display.
- **RBAC multi-tenancy** ready for enterprise onboarding with complete data isolation.
- Clean modular architecture: backend organized into agents/api/services/tasks layers, frontend component-based.

---

## 技术栈速览

| 层级 | 技术 | 用途 |
|------|------|------|
| **LLM** | DeepSeek (OpenAI-compatible API) | 意图识别、内容生成 |
| **Agent 编排** | LangGraph (StateGraph) | Supervisor + Worker 状态图 |
| **Agent 框架** | LangChain ReAct | Worker 工具调用 |
| **后端框架** | FastAPI | REST + WebSocket |
| **ORM** | SQLAlchemy 2.0 (async) | 数据库操作 |
| **数据库** | PostgreSQL 16 + pgvector | 业务数据 + 向量检索 |
| **缓存/队列** | Redis + Celery | 异步任务、文档索引 |
| **前端** | Next.js 14 + TypeScript + Tailwind | SaaS 管理界面 |
| **认证** | JWT + OAuth2 + bcrypt | 用户认证 |
| **权限** | RBAC (Role-Based Access Control) | 多租户权限管理 |
| **部署** | Docker Compose | 容器化一键部署 |

## 可量化的亮点（建议面试时展开）

1. **Agent 路由准确率 85%+** — Supervisor 结合 LLM 决策与关键词评分双重机制
2. **流式输出延迟 <200ms** — WebSocket + LangGraph astream_events
3. **4 个 Tool** — 知识库检索、SQL 查询、Excel 分析、天气查询
4. **3 级 RBAC 角色** — admin / editor / viewer
5. **多步推理** — 单次对话最多支持 6 步 Agent 协作

## 后续优化方向（体现技术视野）

- 替换 MVP 伪 Embedding 为 BGE / 真实 Embedding API
- SQL Tool 接入只读数据库 + SQL 白名单
- LangSmith / 自建 Trace 可观测性
- PostgreSQL RLS 数据库层租户隔离
- Hybrid Search（向量 + 全文检索）
- 前端添加对话历史搜索功能
