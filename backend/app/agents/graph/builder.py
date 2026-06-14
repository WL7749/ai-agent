from langgraph.graph import END, START, StateGraph

from app.agents.graph.nodes import (
    data_node,
    general_node,
    research_node,
    route_after_worker,
    route_from_supervisor,
    supervisor_node,
    synthesize_node,
)
from app.agents.graph.state import AgentState


def build_agent_graph():
    graph = StateGraph(AgentState)

    graph.add_node("supervisor", supervisor_node)
    graph.add_node("research", research_node)
    graph.add_node("data", data_node)
    graph.add_node("general", general_node)
    graph.add_node("synthesize", synthesize_node)

    graph.add_edge(START, "supervisor")
    graph.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        {
            "research": "research",
            "data": "data",
            "general": "general",
            "synthesize": "synthesize",
            "end": END,
        },
    )

    for worker in ("research", "data", "general"):
        graph.add_conditional_edges(
            worker,
            route_after_worker,
            {"supervisor": "supervisor", "synthesize": "synthesize"},
        )

    graph.add_edge("synthesize", END)

    return graph.compile()
