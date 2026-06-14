import re
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models import Permission, Role, RolePermission, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

DEFAULT_PERMISSIONS = [
    ("kb:read", "读取知识库"),
    ("kb:write", "写入知识库"),
    ("agent:execute", "执行 Agent"),
    ("tool:sql", "SQL 查询工具"),
    ("admin:manage", "管理员权限"),
]

DEFAULT_ROLES = {
    "admin": ["kb:read", "kb:write", "agent:execute", "tool:sql", "admin:manage"],
    "editor": ["kb:read", "kb:write", "agent:execute"],
    "viewer": ["kb:read", "agent:execute"],
}


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效凭证")

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(
        select(User)
        .options(selectinload(User.roles).selectinload(Role.permissions))
        .where(User.id == user_id, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    return user


def user_has_permission(user: User, code: str) -> bool:
    for role in user.roles:
        for perm in role.permissions:
            if perm.code == code:
                return True
    return False


def require_permission(code: str):
    async def _checker(user: User = Depends(get_current_user)) -> User:
        if not user_has_permission(user, code):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="权限不足")
        return user

    return _checker


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff]+", "-", name.strip().lower())
    return slug.strip("-") or "tenant"


async def seed_tenant_rbac(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    perm_map: dict[str, Permission] = {}
    for code, desc in DEFAULT_PERMISSIONS:
        result = await db.execute(select(Permission).where(Permission.code == code))
        perm = result.scalar_one_or_none()
        if not perm:
            perm = Permission(code=code, description=desc)
            db.add(perm)
            await db.flush()
        perm_map[code] = perm

    for role_name, perm_codes in DEFAULT_ROLES.items():
        result = await db.execute(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == role_name)
        )
        role = result.scalar_one_or_none()
        if not role:
            role = Role(tenant_id=tenant_id, name=role_name)
            db.add(role)
            await db.flush()
        # Directly insert into role_permissions to avoid MissingGreenlet
        for perm_code in perm_codes:
            if perm_code in perm_map:
                rp = RolePermission(role_id=role.id, permission_id=perm_map[perm_code].id)
                db.add(rp)
        await db.flush()
