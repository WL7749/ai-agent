from langchain_openai import ChatOpenAI

from app.core.config import settings


def get_llm(*, streaming: bool = True) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.DEEPSEEK_MODEL,
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_BASE_URL,
        streaming=streaming,
        temperature=0.3,
    )
