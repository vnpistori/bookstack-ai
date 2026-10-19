from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.api.deps import get_current_user
from app.core.database import get_session
from app.models.user import UserPreference, Profile
from app.models.book import Book


router = APIRouter()


@router.get("/me")
def read_users_me(user: dict = Depends(get_current_user)):
    return user


@router.delete("/me")
@router.delete("/users/me")
def delete_current_user(
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    try:
        _perform_user_deletion(session, user["id"])
        session.commit()
        return {"message": "Conta excluída com sucesso."}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail="Erro ao excluir conta.")


@router.post("/users/sync")
def sync_user_profile(
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    """Sincroniza o usuário do Auth (Supabase) com a tabela de Profile."""
    profile = session.get(Profile, user["id"])
    if not profile:
        profile = Profile(id=user["id"], email=user["email"])
        session.add(profile)
        session.commit()
    return {"status": "synced"}


# --- Admin User Management Helpers ---
def _check_admin_permissions(session: Session, user: dict):
    """Verifica se o usuário atual tem permissão de admin."""
    if user.get("email") == "vipistori@gmail.com":
        return

    requester_profile = session.get(Profile, user["id"])
    if not requester_profile or requester_profile.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")


def _perform_user_deletion(session: Session, target_user_id: str) -> str:
    """Realiza a exclusão dos dados do usuário do banco de dados."""
    target_profile = session.get(Profile, target_user_id)

    if target_profile and target_profile.email == "vipistori@gmail.com":
        raise HTTPException(
            status_code=403, detail="Não é permitido modificar o Super Admin."
        )

    target_email = target_profile.email if target_profile else None

    # 1. Delete User Preferences
    pref = session.get(UserPreference, target_user_id)
    if pref:
        session.delete(pref)

    # 2. Delete User Profile
    if target_profile:
        session.delete(target_profile)

    # 3. Delete User Books
    books = session.exec(select(Book).where(Book.user_id == target_user_id)).all()
    for book in books:
        session.delete(book)

    return target_email


@router.get("/admin/users")
def read_users(
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    _check_admin_permissions(session, user)

    # Fetch all profiles
    profiles = session.exec(select(Profile)).all()

    result = []
    for p in profiles:
        # Fetch status flags from UserPreference
        pref = session.get(UserPreference, p.id)

        user_data = {
            "id": str(p.id),
            "email": p.email,
            "role": p.role,
            "is_active": p.is_active,
            "created_at": p.created_at,
            # Flags from Preferences
            "has_api_keys": pref.has_api_keys if pref else False,
            "has_custom_prompts": pref.has_custom_prompts if pref else False,
            "has_custom_formula": pref.has_custom_formula if pref else False,
            "has_custom_classes": pref.has_custom_classes if pref else False,
            "has_custom_availability": pref.has_custom_availability if pref else False,
        }
        result.append(user_data)

    return result


@router.delete("/admin/users/{target_user_id}")
def delete_user(
    target_user_id: str,
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    _check_admin_permissions(session, user)

    try:
        _perform_user_deletion(session, target_user_id)
        session.commit()
        # _notify_user_deletion call removed
        return {"message": f"Usuário {target_user_id} excluído com sucesso."}
    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        print(f"Erro ao excluir usuário: {e}")
        raise HTTPException(status_code=500, detail="Erro ao excluir usuário")


@router.post("/admin/users/{target_user_id}/toggle_active")
def toggle_user_active(
    target_user_id: str,
    session: Session = Depends(get_session),
    user: dict = Depends(get_current_user),
):
    _check_admin_permissions(session, user)

    try:
        profile = session.get(Profile, target_user_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        if profile.email == "vipistori@gmail.com":
            raise HTTPException(status_code=403, detail="Não permitido.")

        profile.is_active = not profile.is_active
        session.add(profile)
        session.commit()

        status = "ativado" if profile.is_active else "desativado"
        return {
            "message": f"Usuário {status} com sucesso.",
            "is_active": profile.is_active,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Toggle Active Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
