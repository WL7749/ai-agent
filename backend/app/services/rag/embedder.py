import hashlib


def embed_text(text: str, dimension: int = 1536) -> list[float]:
    """MVP 确定性伪 embedding（无需独立 embedding API）。
    生产环境可替换为 BGE / OpenAI embedding。"""
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    values = []
    for i in range(dimension):
        byte = digest[i % len(digest)]
        values.append((byte / 255.0) * 2 - 1)
    return values
