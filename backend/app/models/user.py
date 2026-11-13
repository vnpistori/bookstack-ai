from typing import Optional, Dict, Any
from sqlmodel import Field, SQLModel, JSON
from sqlalchemy import Uuid
from datetime import datetime


class UserPreference(SQLModel, table=True):
    __tablename__ = "user_preferences"

    user_id: str = Field(primary_key=True)
    openai_key: Optional[str] = None
    gemini_key: Optional[str] = None
    groq_key: Optional[str] = None
    preferred_provider: str = Field(default="groq")
    yearly_goal: int = Field(default=20)
    custom_prompts: Dict[str, Any] = Field(default={}, sa_type=JSON)
    formula_config: Dict[str, Any] = Field(default={}, sa_type=JSON)
    class_categories: Dict[str, Any] = Field(default={}, sa_type=JSON)

    # Avatar Settings
    avatar_icon: str = Field(default="User")
    avatar_color: str = Field(default="slate")
    avatar_bg: str = Field(default="slate")

    # Onboarding Flags
    has_api_keys: bool = Field(default=False)
    has_custom_prompts: bool = Field(default=False)
    has_custom_formula: bool = Field(default=False)
    has_custom_classes: bool = Field(default=False)
    has_custom_availability: bool = Field(default=False)

    # Custom Lists
    availability_options: Optional[list] = Field(default=None, sa_type=JSON)
    ignored_audit_issues: Optional[list] = Field(default=[], sa_type=JSON)

    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserPreferenceUpdate(SQLModel):
    openai_key: Optional[str] = None
    gemini_key: Optional[str] = None
    groq_key: Optional[str] = None
    preferred_provider: Optional[str] = None
    yearly_goal: Optional[int] = None
    custom_prompts: Optional[Dict[str, Any]] = None
    formula_config: Optional[Dict[str, Any]] = None
    class_categories: Optional[Dict[str, Any]] = None

    # Avatar Settings
    avatar_icon: Optional[str] = None
    avatar_color: Optional[str] = None
    avatar_bg: Optional[str] = None

    # Custom Lists
    availability_options: Optional[list] = None
    ignored_audit_issues: Optional[list] = None


class Profile(SQLModel, table=True):
    __tablename__ = "profiles"

    id: str = Field(sa_type=Uuid(as_uuid=False), primary_key=True)
    email: str
    role: str = Field(default="user")
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
