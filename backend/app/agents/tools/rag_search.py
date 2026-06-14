from langchain_core.tools import tool


def make_search_knowledge_base_tool(tenant_id: str):
    @tool
    async def search_knowledge_base(query: str) -> str:
        """在租户知识库中进行语义检索，返回相关文档片段。适用于政策、手册、内部文档问答。"""
        from app.services.rag.retriever import search_similar_chunks

        chunks = await search_similar_chunks(tenant_id=tenant_id, query=query, top_k=5)
        if not chunks:
            return "未找到相关知识库内容，请确认文档已上传并完成索引。"
        return "\n\n---\n\n".join(
            f"[来源: {c.get('filename', '未知')}]\n{c['content']}" for c in chunks
        )

    return search_knowledge_base
