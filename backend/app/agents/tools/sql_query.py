from langchain_core.tools import tool


def make_query_database_tool(tenant_id: str):
    @tool
    def query_database(sql: str) -> str:
        """执行只读 SQL 查询。仅允许 SELECT，且会自动限制在当前租户数据范围内。"""
        sql_upper = sql.strip().upper()
        if not sql_upper.startswith("SELECT"):
            return "错误：仅允许 SELECT 只读查询。"
        forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE"]
        if any(kw in sql_upper for kw in forbidden):
            return "错误：检测到危险 SQL 关键字。"

        # MVP：返回模拟结果，后续接入真实只读连接
        return (
            f"[模拟查询结果 | tenant_id={tenant_id}]\n"
            f"SQL: {sql}\n"
            "提示：生产环境将连接只读数据库并注入 tenant 过滤。"
        )

    return query_database
