import logging
import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth.models import User, UserPermission
from auth.schemas import (
    AuthUserResponse,
    LoginRequest,
    LoginResponse,
    OperationResponse,
    PasswordUpdateRequest,
    PermissionsUpdateRequest,
    UserCreateRequest,
    UserUpdateRequest,
)
from auth.security import count_active_admins, create_access_token, get_current_user, hash_password, require_admin, verify_password
from database import SessionLocal, get_db


logger = logging.getLogger(__name__)
router = APIRouter()
APP_VIEW_KEYS = {
    "dashboard", "rm", "regiones", "importaciones",
    "configuracion", "reportes", "ruta", "usuarios",
}


def _validate_role(role: str) -> str:
    if role not in {"admin", "user"}:
        raise HTTPException(status_code=422, detail="Rol inválido. Usa admin o user.")
    return role


def _clean_permissions(permissions: list[str], role: str) -> list[str]:
    invalid = sorted(set(permissions) - APP_VIEW_KEYS)
    if invalid:
        raise HTTPException(status_code=422, detail=f"Permisos inválidos: {', '.join(invalid)}")
    if role != "admin" and "usuarios" in permissions:
        raise HTTPException(status_code=422, detail="El permiso Usuarios solo puede asignarse a administradores.")
    return sorted(set(permissions))


def _permission_keys(user: User) -> list[str]:
    if user.role == "admin":
        return sorted(APP_VIEW_KEYS)
    return sorted(permission.view_key for permission in user.permissions if permission.can_view)


def _serialize_user(user: User) -> AuthUserResponse:
    return AuthUserResponse(
        id=user.id,
        username=user.username,
        displayName=user.display_name,
        role=user.role,
        isActive=user.is_active,
        permissions=_permission_keys(user),
    )


def _replace_permissions(db: Session, user: User, permissions: list[str]) -> None:
    user.permissions.clear()
    db.flush()
    user.permissions.extend(
        UserPermission(view_key=view_key, can_view=True)
        for view_key in _clean_permissions(permissions, user.role)
    )


def ensure_initial_admin() -> None:
    if SessionLocal is None:
        logger.warning("No se puede crear admin inicial: DATABASE_URL no está configurada.")
        return

    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.role == "admin").limit(1)) is not None:
            return
        username = os.getenv("ADMIN_USERNAME", "").strip()
        password = os.getenv("ADMIN_PASSWORD", "")
        display_name = os.getenv("ADMIN_DISPLAY_NAME", "Administrador").strip() or "Administrador"
        if not username or not password:
            logger.warning("No existe un administrador. Configura ADMIN_USERNAME, ADMIN_PASSWORD y JWT_SECRET.")
            return
        db.add(User(
            username=username,
            display_name=display_name,
            password_hash=hash_password(password),
            role="admin",
            is_active=True,
        ))
        db.commit()
        logger.warning("Usuario administrador inicial creado desde variables de entorno.")


@router.post("/api/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.scalar(select(User).where(User.username == payload.username.strip()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario o contraseña incorrectos.")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="El usuario está inactivo.")
    return LoginResponse(access_token=create_access_token(user), user=_serialize_user(user))


@router.get("/api/auth/me", response_model=AuthUserResponse)
def me(current_user: User = Depends(get_current_user)) -> AuthUserResponse:
    return _serialize_user(current_user)


@router.post("/api/auth/logout", response_model=OperationResponse)
def logout(_: User = Depends(get_current_user)) -> OperationResponse:
    # TODO: migrar a cookie HttpOnly y revocación de sesión si aumenta el nivel de exposición.
    return OperationResponse()


@router.get("/api/admin/users", response_model=list[AuthUserResponse])
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[AuthUserResponse]:
    return [_serialize_user(user) for user in db.scalars(select(User).order_by(User.created_at.asc())).all()]


@router.post("/api/admin/users", response_model=AuthUserResponse, status_code=201)
def create_user(payload: UserCreateRequest, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> AuthUserResponse:
    username = payload.username.strip()
    if db.scalar(select(User.id).where(User.username == username)) is not None:
        raise HTTPException(status_code=409, detail="El nombre de usuario ya existe.")
    user = User(
        username=username,
        display_name=payload.displayName.strip(),
        password_hash=hash_password(payload.password),
        role=_validate_role(payload.role),
        is_active=True,
    )
    db.add(user)
    db.flush()
    _replace_permissions(db, user, payload.permissions)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.put("/api/admin/users/{user_id}", response_model=AuthUserResponse)
def update_user(
    user_id: int,
    payload: UserUpdateRequest,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AuthUserResponse:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    next_role = _validate_role(payload.role) if payload.role is not None else user.role
    next_active = payload.isActive if payload.isActive is not None else user.is_active
    removes_admin = user.role == "admin" and user.is_active and (next_role != "admin" or not next_active)
    if removes_admin and count_active_admins(db) <= 1:
        raise HTTPException(status_code=409, detail="No puedes desactivar o degradar al último administrador.")
    if current_admin.id == user.id and not next_active:
        raise HTTPException(status_code=409, detail="No puedes desactivar tu propia cuenta.")
    if payload.displayName is not None:
        user.display_name = payload.displayName.strip()
    user.role = next_role
    user.is_active = next_active
    if user.role == "admin":
        user.permissions.clear()
    else:
        _replace_permissions(db, user, [permission.view_key for permission in user.permissions if permission.view_key != "usuarios"])
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


@router.put("/api/admin/users/{user_id}/password", response_model=OperationResponse)
def update_password(
    user_id: int,
    payload: PasswordUpdateRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> OperationResponse:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    user.password_hash = hash_password(payload.password)
    db.commit()
    return OperationResponse()


@router.put("/api/admin/users/{user_id}/permissions", response_model=AuthUserResponse)
def update_permissions(
    user_id: int,
    payload: PermissionsUpdateRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AuthUserResponse:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if user.role != "admin":
        _replace_permissions(db, user, payload.permissions)
        db.commit()
        db.refresh(user)
    return _serialize_user(user)


@router.delete("/api/admin/users/{user_id}", response_model=AuthUserResponse)
def deactivate_user(
    user_id: int,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AuthUserResponse:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    if user.id == current_admin.id:
        raise HTTPException(status_code=409, detail="No puedes desactivar tu propia cuenta.")
    if user.role == "admin" and user.is_active and count_active_admins(db) <= 1:
        raise HTTPException(status_code=409, detail="No puedes desactivar al último administrador.")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return _serialize_user(user)
