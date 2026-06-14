from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str | None = None
    tenant_name: str = Field(min_length=2, description="企业/团队名称")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str | None
    tenant_id: str

    model_config = {"from_attributes": True}


class KnowledgeBaseCreate(BaseModel):
    name: str
    description: str | None = None


class KnowledgeBaseOut(BaseModel):
    id: str
    name: str
    description: str | None

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: str
    filename: str
    status: str
    kb_id: str

    model_config = {"from_attributes": True}


class ChatSessionCreate(BaseModel):
    title: str = "新对话"


class ChatSessionUpdate(BaseModel):
    title: str


class ChatSessionOut(BaseModel):
    id: str
    title: str

    model_config = {"from_attributes": True}


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    tool_calls: dict | None = None
    created_at: str | None = None

    model_config = {"from_attributes": True}
