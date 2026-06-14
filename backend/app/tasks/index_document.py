import uuid

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models import Document
from app.services.rag.parser import chunk_text, parse_document
from app.tasks.celery_app import celery_app

sync_engine = create_engine(settings.DATABASE_URL_SYNC)
SyncSession = sessionmaker(sync_engine, class_=Session)


@celery_app.task(name="index_document")
def index_document_task(document_id: str) -> dict:
    doc_uuid = uuid.UUID(document_id)
    with SyncSession() as db:
        document = db.execute(select(Document).where(Document.id == doc_uuid)).scalar_one_or_none()
        if not document:
            return {"status": "error", "message": "文档不存在"}

        document.status = "processing"
        db.commit()

        try:
            text = parse_document(document.file_path)
            chunks = chunk_text(text)
            if not chunks:
                document.status = "failed"
                db.commit()
                return {"status": "failed", "message": "无法解析文档内容"}

            # 清除旧 chunks（重新索引）
            for old in document.chunks:
                db.delete(old)
            db.flush()

            index_document_chunks_sync(db, document, chunks)
            document.status = "indexed"
            db.commit()
            return {"status": "indexed", "chunks": len(chunks)}
        except Exception as e:
            document.status = "failed"
            db.commit()
            return {"status": "failed", "message": str(e)}


def index_document_chunks_sync(db: Session, document: Document, chunks: list[str]) -> None:
    from app.models import DocumentChunk
    from app.services.rag.embedder import embed_text

    for idx, content in enumerate(chunks):
        chunk = DocumentChunk(
            document_id=document.id,
            tenant_id=document.tenant_id,
            content=content,
            chunk_index=idx,
            embedding=embed_text(content, settings.EMBEDDING_DIMENSION),
            metadata_={"filename": document.filename, "chunk_index": idx},
        )
        db.add(chunk)
