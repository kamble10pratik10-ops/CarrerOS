import os
from datetime import datetime, timezone, date
from src.lib.supabase_client import get_supabase_client


def save_coding_session(email: str, session_data: dict):
    try:
        client = get_supabase_client()
        session_data["email"] = email.lower()
        session_data["created_at"] = datetime.now(timezone.utc).isoformat()
        result = client.table("coding_sessions").insert(session_data).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Supabase save_coding_session error: {e}")
        return None


def get_coding_sessions(email: str, problem_id: str = None):
    try:
        client = get_supabase_client()
        query = client.table("coding_sessions").select("*").eq("email", email.lower()).order("created_at", desc=True)
        if problem_id:
            query = query.eq("problem_id", problem_id)
        result = query.limit(50).execute()
        return result.data or []
    except Exception as e:
        print(f"Supabase get_coding_sessions error: {e}")
        return []


def update_coding_session(session_id: str, updates: dict):
    try:
        client = get_supabase_client()
        result = client.table("coding_sessions").update(updates).eq("id", session_id).execute()
        return result.data[0] if result.data else None
    except Exception as e:
        print(f"Supabase update_coding_session error: {e}")
        return None


def get_coding_progress(email: str):
    try:
        client = get_supabase_client()
        result = client.table("coding_progress").select("*").eq("email", email.lower()).execute()
        if result.data:
            return result.data[0]
        return None
    except Exception as e:
        print(f"Supabase get_coding_progress error: {e}")
        return None


def update_coding_progress(email: str, progress_data: dict):
    try:
        client = get_supabase_client()
        progress_data["email"] = email.lower()
        progress_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        progress_data["last_active"] = date.today().isoformat()

        existing = get_coding_progress(email)
        if existing:
            client.table("coding_progress").update(progress_data).eq("email", email.lower()).execute()
        else:
            client.table("coding_progress").insert(progress_data).execute()
        return True
    except Exception as e:
        print(f"Supabase update_coding_progress error: {e}")
        return False
