import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models import Document, DocumentChunk
from app.services.rag.embedder import embed_text


async def search_similar_chunks(
    tenant_id: str, query: str, top_k: int = 5
) -> list[dict]:
    query_vec = embed_text(query, settings.EMBEDDING_DIMENSION)
    vec_str = "[" + ",".join(str(v) for v in query_vec) + "]"

    async with AsyncSessionLocal() as db:
        sql = text(
            """
            SELECT dc.content, dc.metadata, d.filename
            FROM document_chunks dc
            JOIN documents d ON d.id = dc.document_id
            WHERE dc.tenant_id = :tenant_id
              AND dc.embedding IS NOT NULL
            ORDER BY dc.embedding <=> :query_vec::vector
            LIMIT :top_k
            """
        )
        result = await db.execute(
            sql,
            {"tenant_id": uuid.UUID(tenant_id), "query_vec": vec_str, "top_k": top_k},
        )
        rows = result.fetchall()
        return [
            {"content": row.content, "metadata": row.metadata, "filename": row.filename}
            for row in rows
        ]


async def index_document_chunks(
    db: AsyncSession,
    document: Document,
    chunks: list[str],
) -> None:
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
