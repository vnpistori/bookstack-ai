from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from datetime import datetime
from app.api.deps import get_current_user
from app.core.database import get_session
from app.models.user import UserPreference, UserPreferenceUpdate
from app.models.book import Book
from app.core.security import encrypt_value, decrypt_value
from app.services.scoring import (
    calculate_book_score,
    CLASS_CATEGORIES,
    DEFAULT_AVAILABILITY_OPTIONS,
)

router = APIRouter()

# --- Preferences Helpers ---


def _update_api_keys(pref: UserPreference, pref_data: UserPreferenceUpdate):
    """Atualiza e criptografa as chaves de API."""
    if pref_data.openai_key is not None:
        pref.openai_key = encrypt_value(pref_data.openai_key)
    if pref_data.gemini_key is not None:
        pref.gemini_key = encrypt_value(pref_data.gemini_key)
    if pref_data.groq_key is not None:
        pref.groq_key = encrypt_value(pref_data.groq_key)
    if pref_data.preferred_provider is not None:
        pref.preferred_provider = pref_data.preferred_provider


def _update_avatar_settings(pref: UserPreference, pref_data: UserPreferenceUpdate):
    """Atualiza as configurações visuais do avatar."""
    if pref_data.avatar_icon is not None:
        pref.avatar_icon = pref_data.avatar_icon
    if pref_data.avatar_color is not None:
        pref.avatar_color = pref_data.avatar_color
    if pref_data.avatar_bg is not None:
        pref.avatar_bg = pref_data.avatar_bg


def _update_functional_settings(pref: UserPreference, pref_data: UserPreferenceUpdate):
    """Atualiza configurações funcionais."""
    if pref_data.availability_options is not None:
        pref.availability_options = pref_data.availability_options
    if pref_data.ignored_audit_issues is not None:
        pref.ignored_audit_issues = pref_data.ignored_audit_issues


def _check_nonzero(d):
    """Helper recursivo para verificar pesos > 0 em dicionários aninhados."""
    for k, v in d.items():
        if isinstance(v, dict):
            if _check_nonzero(v):
                return True
        elif isinstance(v, (int, float)) and v > 0:
            return True
        elif isinstance(v, list):
            for item in v:
                if isinstance(item, dict) and item.get("weight", 0) > 0:
                    return True
    return False


def _refresh_flags(pref: UserPreference):
    """Recalcula todas as flags booleanas baseadas no estado atual."""
    # 1. API Keys
    pref.has_api_keys = bool(
        (pref.openai_key and len(pref.openai_key) > 5)
        or (pref.gemini_key and len(pref.gemini_key) > 5)
        or (pref.groq_key and len(pref.groq_key) > 5)
    )

    # 2. Custom Prompts
    if pref.custom_prompts and len(pref.custom_prompts) > 0:
        pref.has_custom_prompts = True
    else:
        pref.has_custom_prompts = False

    # 3. Custom Formula
    config_to_check = pref.formula_config or {}
    pref.has_custom_formula = _check_nonzero(config_to_check)

    # 4. Custom Classes
    def _is_custom(current, default):
        if not current:
            return False
        if current.keys() != default.keys():
            return True
        for k in current:
            if sorted(current[k]) != sorted(default[k]):
                return True
        return False

    current_classes = pref.class_categories or {}
    if _is_custom(current_classes, CLASS_CATEGORIES):
        pref.has_custom_classes = True
    else:
        pref.has_custom_classes = False

    # 5. Custom Availability
    current_avail = pref.availability_options or []
    if current_avail and current_avail != DEFAULT_AVAILABILITY_OPTIONS:
        pref.has_custom_availability = True
    else:
        pref.has_custom_availability = False


@router.get("/", response_model=UserPreference)
def get_preferences(
    session: Session = Depends(get_session), user: dict = Depends(get_current_user)
):
    user_id = user["id"]
    pref = session.get(UserPreference, user_id)
    if not pref:
        # Create default
        pref = UserPreference(user_id=user_id)
        session.add(pref)
        session.commit()
        session.refresh(pref)

    # Need to verify decrypt_value logic here if it handles None gracefully. It should.
    return UserPreference(
        user_id=str(pref.user_id),
        yearly_goal=pref.yearly_goal,
        custom_prompts=pref.custom_prompts,
        formula_config=pref.formula_config,
        class_categories=pref.class_categories,
        has_api_keys=pref.has_api_keys,
        has_custom_prompts=pref.has_custom_prompts,
        has_custom_formula=pref.has_custom_formula,
        has_custom_classes=pref.has_custom_classes,
        has_custom_availability=pref.has_custom_availability,
        availability_options=pref.availability_options,
        ignored_audit_issues=pref.ignored_audit_issues,
        updated_at=pref.updated_at,
        openai_key=decrypt_value(pref.openai_key),
        gemini_key=decrypt_value(pref.gemini_key),
        groq_key=decrypt_value(pref.groq_key),
        avatar_icon=pref.avatar_icon,
        avatar_color=pref.avatar_color,
        avatar_bg=pref.avatar_bg,
        preferred_provider=pref.preferred_provider,
    )


@router.put("/", response_model=UserPreference)
def update_preferences(
    pref_data: UserPreferenceUpdate,
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    user_id = user["id"]
    pref = session.get(UserPreference, user_id)
    if not pref:
        pref = UserPreference(user_id=user_id)

    # Trigger recalculation check
    formula_changed = False
    if (
        pref_data.formula_config is not None
        and pref_data.formula_config != pref.formula_config
    ):
        formula_changed = True
        pref.formula_config = pref_data.formula_config
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(pref, "formula_config")

    if pref_data.class_categories is not None:
        pref.class_categories = pref_data.class_categories
    if pref_data.custom_prompts is not None:
        pref.custom_prompts = pref_data.custom_prompts
    if pref_data.yearly_goal is not None:
        pref.yearly_goal = pref_data.yearly_goal

    _update_api_keys(pref, pref_data)
    _update_avatar_settings(pref, pref_data)
    _update_functional_settings(pref, pref_data)
    _refresh_flags(pref)

    pref.updated_at = datetime.utcnow()
    session.add(pref)

    if formula_changed:
        books = session.exec(select(Book).where(Book.user_id == user_id)).all()
        for book in books:
            book.score = calculate_book_score(book, pref.formula_config)
            session.add(book)

    session.commit()
    session.refresh(pref)

    # Construct response similar to GET
    return get_preferences(
        session, user
    )  # Reuse GET logic for cleaner response construction
