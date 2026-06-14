# Enterprise AI Agent Platform

企业级 AI Agent 工作平台 — 基于 **FastAPI + LangGraph + DeepSeek**，支持多 Agent 协作、Tool Calling、RAG 知识库、WebSocket 流式输出与 RBAC 多租户。

## 技术栈

| 层级 | 技术 |
|------|------|
| LLM | DeepSeek（OpenAI 兼容 API） |
| Agent 编排 | LangGraph（Supervisor + Worker） |
| 后端 | FastAPI + SQLAlchemy 2 |
| 向量库 | PostgreSQL + pgvector |
| 任务队列 | Redis + Celery |
| 前端 | Next.js 14 + TypeScript + Tailwind |

## 快速开始

### 1. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
```

在 [DeepSeek 开放平台](https://platform.deepseek.com) 获取 API Key。

### 2. Docker 一键启动

```bash
docker compose up --build
```

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| 后端 API | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |
| 健康检查 | http://localhost:8000/health |

### 3. 本地开发（不用 Docker）

**后端：**

```bash
cd backend
pip install -e .
# 确保 PostgreSQL(pgvector) 和 Redis 已运行
uvicorn app.main:app --reload --port 8000
celery -A app.tasks.celery_app worker --loglevel=info
```

**前端：**

```bash
cd frontend
npm install
npm run dev
```

## 功能概览

- **多 Agent 协作**：Supervisor 路由 → Research / Data / General Agent
- **Tool Calling**：知识库检索、SQL 查询（只读）、Excel 分析、天气 API
- **RAG 知识库**：PDF/Word/TXT 上传 → Celery 异步索引 → pgvector 语义检索
- **WebSocket 流式**：Token 级输出 + Tool 调用状态推送
- **RBAC 多租户**：注册时自动创建租户与 admin/editor/viewer 角色

## 项目结构

```
ai-agent/
├── backend/app/
│   ├── agents/graph/     # LangGraph 状态图
│   ├── agents/tools/     # Function Calling 工具
│   ├── api/v1/           # REST + WebSocket
│   ├── services/rag/     # 文档解析与检索
│   └── tasks/            # Celery 异步任务
└── frontend/src/app/     # Next.js 页面
```

## 云上部署（Railway 示例）

1. 推送代码到 GitHub
2. Railway 新建项目，添加 PostgreSQL、Redis 服务
3. 部署 `backend` 与 `frontend` 两个 Service
4. 配置环境变量：
   - `DEEPSEEK_API_KEY`
   - `DATABASE_URL` / `DATABASE_URL_SYNC`
   - `REDIS_URL` / `CELERY_BROKER_URL`
   - `SECRET_KEY`
   - `CORS_ORIGINS=https://你的前端域名`
   - `NEXT_PUBLIC_API_URL=https://你的后端域名`
   - `NEXT_PUBLIC_WS_URL=wss://你的后端域名`
5. PostgreSQL 需启用 pgvector：`CREATE EXTENSION vector;`

## 简历描述参考

> 独立设计并实现企业级 AI Agent SaaS 平台。后端基于 FastAPI + LangGraph，使用 DeepSeek 实现 Supervisor 多 Agent 协作与 Tool Registry；PostgreSQL + pgvector 构建 RAG 知识库；Redis + Celery 处理文档异步索引；WebSocket 实现流式输出与 Tool 状态推送；RBAC + tenant_id 实现多租户隔离。前端 Next.js + TypeScript 构建 SaaS 管理界面。

## 后续迭代

- [ ] 替换 MVP 伪 Embedding 为 BGE / 真实 Embedding API
- [ ] SQL Tool 接入只读数据库 + 表白名单
- [ ] LangSmith / 自建 Trace 可观测性
- [ ] PostgreSQL RLS 数据库层租户隔离
- [ ] Hybrid Search（向量 + 全文检索）
