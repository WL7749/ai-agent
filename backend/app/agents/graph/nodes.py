from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

from app.agents.graph.router import (
    AGENT_LABELS,
    MAX_GRAPH_STEPS,
    SUPERVISOR_PROMPT,
    WORKER_PROMPTS,
    build_supervisor_context,
    heuristic_route,
    parse_supervisor_decision,
    should_finish,
)
from app.agents.graph.state import AgentState, RouteTarget
from app.agents.llm import get_llm
from app.agents.tools.registry import get_data_tools, get_general_tools, get_research_tools


def _latest_user_text(state: AgentState) -> str:
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            return msg.content if isinstance(msg.content, str) else str(msg.content)
    return ""


async def supervisor_node(state: AgentState) -> dict:
    step = state.get("step_count", 0) + 1
    history: list[str] = list(state.get("route_history", []))
    last_worker = state.get("last_worker", "")

    # 安全阀：步数或重复路由过多 → 直接 FINISH
    if should_finish(step, history, last_worker or None):
        return {"next_agent": "FINISH", "step_count": step}

    user_text = _latest_user_text(state)
    context = build_supervisor_context(history, step)

    llm = get_llm(streaming=False)
    response = await llm.ainvoke(
        [
            SystemMessage(content=SUPERVISOR_PROMPT),
            SystemMessage(content=context),
            *state["messages"][-8:],
        ]
    )
    raw = response.content if isinstance(response.content, str) else str(response.content)
    decision = parse_supervisor_decision(raw)

    if decision is None:
        decision = heuristic_route(user_text, history)

    # Worker 已执行且 LLM 再次指向同一 Agent → 改为 FINISH，避免死循环
    if decision != "FINISH" and decision == last_worker:
        decision = "FINISH"

    # 首次路由：若 LLM 说 FINISH 但尚未执行任何 Worker，走启发式
    if decision == "FINISH" and not history:
        decision = heuristic_route(user_text, history)

    if decision != "FINISH":
        history = history + [decision]

    return {
        "next_agent": decision,
        "route_history": [decision] if decision != "FINISH" else [],
        "step_count": step,
    }


async def _run_worker(state: AgentState, agent_key: RouteTarget) -> dict:
    tool_map = {
        "research": lambda: get_research_tools(state["tenant_id"]),
        "data": lambda: get_data_tools(state["tenant_id"]),
        "general": get_general_tools,
    }
    tools = tool_map[agent_key]()
    llm = get_llm(streaming=True)
    agent = create_react_agent(llm, tools)
    result = await agent.ainvoke(
        {"messages": [SystemMessage(content=WORKER_PROMPTS[agent_key]), *state["messages"]]}
    )
    last_msg = result["messages"][-1]
    label = AGENT_LABELS.get(agent_key, agent_key)
    # 在消息 metadata 中标记来源 Agent（便于前端展示）
    if isinstance(last_msg, AIMessage):
        tagged = AIMessage(
            content=last_msg.content,
            additional_kwargs={**last_msg.additional_kwargs, "agent": agent_key, "agent_label": label},
        )
        return {"messages": [tagged], "last_worker": agent_key}
    return {"messages": [last_msg], "last_worker": agent_key}


async def research_node(state: AgentState) -> dict:
    return await _run_worker(state, "research")


async def data_node(state: AgentState) -> dict:
    return await _run_worker(state, "data")


async def general_node(state: AgentState) -> dict:
    return await _run_worker(state, "general")


async def synthesize_node(state: AgentState) -> dict:
    """汇总多 Agent 结果，生成最终用户可见答复。"""
    from app.agents.graph.router import SYNTHESIS_PROMPT

    llm = get_llm(streaming=True)
    response = await llm.ainvoke(
        [SystemMessage(content=SYNTHESIS_PROMPT), *state["messages"][-12:]]
    )
    if isinstance(response, AIMessage):
        tagged = AIMessage(
            content=response.content,
            additional_kwargs={"agent": "synthesizer", "agent_label": "最终答复"},
        )
        return {"messages": [tagged]}
    return {"messages": [AIMessage(content=str(response.content))]}


def route_from_supervisor(state: AgentState) -> str:
    nxt = state.get("next_agent", "general")
    history = state.get("route_history", [])

    if nxt in ("FINISH", "finish"):
        if not history:
            return "general"
        if len(history) <= 1:
            return "end"
        return "synthesize"

    if nxt in ("research", "data", "general"):
        return nxt
    return "general"


def route_after_worker(state: AgentState) -> str:
    """Worker 完成后回到 Supervisor 继续调度。"""
    step = state.get("step_count", 0)
    if step >= MAX_GRAPH_STEPS:
        return "synthesize"
    return "supervisor"
