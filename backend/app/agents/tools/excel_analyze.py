from langchain_core.tools import tool


@tool
def analyze_excel(file_path: str, operation: str = "summary") -> str:
    """分析 Excel 文件，支持 summary（摘要统计）、columns（列信息）等操作。"""
    try:
        import pandas as pd

        df = pd.read_excel(file_path)
        if operation == "columns":
            return f"列名: {list(df.columns)}\n行数: {len(df)}"
        return f"行数: {len(df)}, 列数: {len(df.columns)}\n列名: {list(df.columns)}\n\n前5行:\n{df.head().to_string()}"
    except FileNotFoundError:
        return f"文件不存在: {file_path}"
    except Exception as e:
        return f"分析失败: {e}"
