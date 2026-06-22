from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=200)


class AuthUserResponse(BaseModel):
    id: int
    username: str
    displayName: str
    role: str
    isActive: bool
    permissions: list[str]


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserResponse


class UserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    displayName: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=8, max_length=200)
    role: str = "user"
    permissions: list[str] = Field(default_factory=list)


class UserUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    displayName: str | None = Field(default=None, min_length=1, max_length=160)
    role: str | None = None
    isActive: bool | None = None


class PasswordUpdateRequest(BaseModel):
    password: str = Field(min_length=8, max_length=200)


class PermissionsUpdateRequest(BaseModel):
    permissions: list[str] = Field(default_factory=list)


class OperationResponse(BaseModel):
    ok: bool = True
