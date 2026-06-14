from operator import add
from typing import Annotated, Literal

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

RouteTarget = Literal["research", "data", "general", "FINISH"]


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    tenant_id: str
    user_id: str
    next_agent: str
    route_history: Annotated[list[str], add]
    step_count: int
    last_worker: str
