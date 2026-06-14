import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete as sa_delete, select, update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.models import ChatMessage, ChatSession, User
from app.schemas import ChatMessageOut, ChatSessionCreate, ChatSessionOut, ChatSessionUpdate

router = APIRouter(prefix="/chat", tags=["对话"])


@router.post("/sessions", response_model=ChatSessionOut)
async def create_session(
    body: ChatSessionCreate,
    user: User = Depends(require_permission("agent:execute")),
    db: AsyncSession = Depends(get_db),
):
    session = ChatSession(tenant_id=user.tenant_id, user_id=user.id, title=body.title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return ChatSessionOut(id=str(session.id), title=session.title)


@router.get("/sessions", response_model=list[ChatSessionOut])
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.user_id == user.id, ChatSession.tenant_id == user.tenant_id
        ).order_by(ChatSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return [ChatSessionOut(id=str(s.id), title=s.title) for s in sessions]


@router.patch("/sessions/{session_id}", response_model=ChatSessionOut)
async def update_session(
    session_id: str,
    body: ChatSessionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == uuid.UUID(session_id),
            ChatSession.user_id == user.id,
            ChatSession.tenant_id == user.tenant_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    session.title = body.title
    await db.commit()
    await db.refresh(session)
    return ChatSessionOut(id=str(session.id), title=session.title)


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == uuid.UUID(session_id),
            ChatSession.user_id == user.id,
            ChatSession.tenant_id == user.tenant_id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    # Delete all messages in the session first
    await db.execute(
        sa_delete(ChatMessage).where(ChatMessage.session_id == session.id)
    )
    await db.delete(session)
    await db.commit()
    return {"ok": True}


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
async def get_session_messages(
    session_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatMessage).where(
            ChatMessage.session_id == uuid.UUID(session_id),
        ).order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        ChatMessageOut(
            id=str(m.id),
            role=m.role,
            content=m.content,
            tool_calls=m.tool_calls,
            created_at=m.created_at.isoformat() if m.created_at else None,
        )
        for m in messages
    ]
