import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user, require_permission
from app.models import Document, KnowledgeBase, User
from app.schemas import DocumentOut, KnowledgeBaseCreate, KnowledgeBaseOut
from app.tasks.index_document import index_document_task

router = APIRouter(prefix="/knowledge", tags=["知识库"])

UPLOAD_ROOT = Path(settings.UPLOAD_DIR)
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


@router.post("/bases", response_model=KnowledgeBaseOut)
async def create_knowledge_base(
    body: KnowledgeBaseCreate,
    user: User = Depends(require_permission("kb:write")),
    db: AsyncSession = Depends(get_db),
):
    kb = KnowledgeBase(tenant_id=user.tenant_id, name=body.name, description=body.description)
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    return KnowledgeBaseOut(id=str(kb.id), name=kb.name, description=kb.description)


@router.get("/bases", response_model=list[KnowledgeBaseOut])
async def list_knowledge_bases(
    user: User = Depends(require_permission("kb:read")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(KnowledgeBase).where(KnowledgeBase.tenant_id == user.tenant_id)
    )
    bases = result.scalars().all()
    return [
        KnowledgeBaseOut(id=str(kb.id), name=kb.name, description=kb.description) for kb in bases
    ]


@router.post("/documents/upload", response_model=DocumentOut)
async def upload_document(
    kb_id: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(require_permission("kb:write")),
    db: AsyncSession = Depends(get_db),
):
    kb = (
        await db.execute(
            select(KnowledgeBase).where(
                KnowledgeBase.id == uuid.UUID(kb_id),
                KnowledgeBase.tenant_id == user.tenant_id,
            )
        )
    ).scalar_one_or_none()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    suffix = Path(file.filename or "doc.txt").suffix.lower()
    if suffix not in (".pdf", ".docx", ".doc", ".txt"):
        raise HTTPException(status_code=400, detail="仅支持 PDF、Word、TXT")

    tenant_dir = UPLOAD_ROOT / str(user.tenant_id)
    tenant_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}{suffix}"
    file_path = tenant_dir / safe_name

    content = await file.read()
    file_path.write_bytes(content)

    doc = Document(
        kb_id=kb.id,
        tenant_id=user.tenant_id,
        filename=file.filename or safe_name,
        file_path=str(file_path),
        status="pending",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    index_document_task.delay(str(doc.id))

    return DocumentOut(id=str(doc.id), filename=doc.filename, status=doc.status, kb_id=str(doc.kb_id))


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(
    user: User = Depends(require_permission("kb:read")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Document).where(Document.tenant_id == user.tenant_id))
    docs = result.scalars().all()
    return [
        DocumentOut(id=str(d.id), filename=d.filename, status=d.status, kb_id=str(d.kb_id))
        for d in docs
    ]
