from langchain_core.tools import BaseTool


def get_research_tools(tenant_id: str) -> list[BaseTool]:
    from app.agents.tools.rag_search import make_search_knowledge_base_tool

    return [make_search_knowledge_base_tool(tenant_id)]


def get_data_tools(tenant_id: str) -> list[BaseTool]:
    from app.agents.tools.excel_analyze import analyze_excel
    from app.agents.tools.sql_query import make_query_database_tool

    return [make_query_database_tool(tenant_id), analyze_excel]


def get_general_tools() -> list[BaseTool]:
    from app.agents.tools.weather import get_weather

    return [get_weather]
