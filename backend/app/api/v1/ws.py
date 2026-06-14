import json
import logging
import uuid

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from langchain_core.messages import AIMessage, HumanMessage
from sqlalchemy import select, update as sa_update

from app.agents.graph.builder import build_agent_graph
from app.agents.graph.router import AGENT_LABELS
from app.core.database import AsyncSessionLocal
from app.core.security import decode_access_token
from app.models import ChatMessage, ChatSession, User

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])

DEFAULT_TITLE = "新对话"


async def authenticate_ws(token: str) -> User | None:
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None
    user_id = uuid.UUID(payload["sub"])
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
        return result.scalar_one_or_none()


@router.websocket("/ws/chat/{session_id}")
async def chat_websocket(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(...),
):
    user = await authenticate_ws(token)
    if not user:
        await websocket.close(code=4001, reason="未授权")
        return

    async with AsyncSessionLocal() as db:
        session = (
            await db.execute(
                select(ChatSession).where(
                    ChatSession.id == uuid.UUID(session_id),
                    ChatSession.user_id == user.id,
                    ChatSession.tenant_id == user.tenant_id,
                )
            )
        ).scalar_one_or_none()
        if not session:
            await websocket.close(code=4004, reason="会话不存在")
            return
        session_title = session.title

    await websocket.accept()
    graph = build_agent_graph()

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            user_message = data.get("message", "").strip()
            if not user_message:
                continue

            async with AsyncSessionLocal() as db:
                # Auto-title: use first user message as session title
                if session_title == DEFAULT_TITLE:
                    title = user_message[:50]
                    if len(title) == 50:
                        title += "…"
                    await db.execute(
                        sa_update(ChatSession)
                        .where(ChatSession.id == uuid.UUID(session_id))
                        .values(title=title)
                    )
                    session_title = title
                    # Send title update to frontend
                    await websocket.send_json({"type": "title_update", "title": title})

                db.add(
                    ChatMessage(session_id=uuid.UUID(session_id), role="user", content=user_message)
                )
                await db.commit()

            state = {
                "messages": [HumanMessage(content=user_message)],
                "tenant_id": str(user.tenant_id),
                "user_id": str(user.id),
                "next_agent": "",
                "route_history": [],
                "step_count": 0,
                "last_worker": "",
            }

            full_response = ""
            route_trail: list[str] = []
            current_stream_agent = ""
            stream_error = None

            try:
                async for event in graph.astream_events(state, version="v2"):
                    kind = event.get("event")
                    # metadata could be a dict or a string in some event types
                    metadata = event.get("metadata")
                    if isinstance(metadata, dict):
                        node = metadata.get("langgraph_node", "")
                    else:
                        node = ""

                    # Supervisor 路由事件
                    if kind == "on_chain_end" and node == "supervisor":
                        data = event.get("data")
                        if isinstance(data, dict):
                            output = data.get("output") or {}
                        else:
                            output = {}
                        if isinstance(output, dict):
                            agent = output.get("next_agent", "")
                        else:
                            agent = ""
                        if agent and agent not in ("FINISH", "finish"):
                            label = AGENT_LABELS.get(agent, agent)
                            route_trail.append(agent)
                            await websocket.send_json(
                                {"type": "route", "agent": agent, "label": label, "trail": route_trail.copy()}
                            )

                    if kind == "on_chat_model_stream":
                        data = event.get("data")
                        if isinstance(data, dict):
                            chunk = data.get("chunk")
                        else:
                            chunk = None
                        if chunk and hasattr(chunk, "content") and chunk.content:
                            if node and node != current_stream_agent:
                                current_stream_agent = node
                                if node in AGENT_LABELS:
                                    await websocket.send_json(
                                        {"type": "agent_stream", "agent": node, "label": AGENT_LABELS[node]}
                                    )
                            full_response += chunk.content
                            await websocket.send_json({"type": "token", "content": chunk.content})

                    elif kind == "on_tool_start":
                        data = event.get("data")
                        await websocket.send_json(
                            {
                                "type": "tool_start",
                                "tool": event.get("name"),
                                "input": data.get("input") if isinstance(data, dict) else None,
                            }
                        )
                    elif kind == "on_tool_end":
                        data = event.get("data")
                        await websocket.send_json(
                            {
                                "type": "tool_end",
                                "tool": event.get("name"),
                                "output": str(data.get("output", "") if isinstance(data, dict) else "")[:500],
                            }
                        )
            except Exception as e:
                logger.exception("Agent graph error")
                stream_error = str(e)
                if not full_response:
                    error_msg = "抱歉，AI 服务暂时不可用。请检查 API 配置后重试。"
                    full_response = error_msg
                    await websocket.send_json({"type": "token", "content": error_msg})

            if not full_response and not stream_error:
                try:
                    result = await graph.ainvoke(state)
                    last = result["messages"][-1]
                    if isinstance(last, AIMessage):
                        full_response = last.content if isinstance(last.content, str) else str(last.content)
                        await websocket.send_json({"type": "token", "content": full_response})
                except Exception as e:
                    logger.error("Agent graph ainvoke error: %s", e)
                    if not full_response:
                        full_response = "抱歉，AI 服务暂时不可用。请稍后重试。"
                        await websocket.send_json({"type": "token", "content": full_response})

            async with AsyncSessionLocal() as db:
                db.add(
                    ChatMessage(
                        session_id=uuid.UUID(session_id),
                        role="assistant",
                        content=full_response,
                        tool_calls={"route_trail": route_trail} if route_trail else None,
                    )
                )
                await db.commit()

            await websocket.send_json({"type": "done", "route_trail": route_trail})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("WebSocket error: %s", e)
        try:
            await websocket.send_json({"type": "error", "content": "连接异常，请刷新页面重试"})
        except Exception:
            pass
