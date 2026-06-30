import os
from datetime import datetime, timezone
from src.lib.supabase_client import get_supabase_client
import json

LOCAL_USERS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "local_data", "users.json")

def _load_local_users():
    if os.path.exists(LOCAL_USERS_FILE):
        try:
            with open(LOCAL_USERS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def _save_local_users(users):
    os.makedirs(os.path.dirname(LOCAL_USERS_FILE), exist_ok=True)
    try:
        with open(LOCAL_USERS_FILE, "w") as f:
            json.dump(users, f, indent=2)
    except Exception as e:
        print(f"Failed to save local users: {e}")

def user_exists(email: str) -> bool:
    try:
        client = get_supabase_client()
        res = client.table("users").select("email").eq("email", email.lower()).execute()
        return len(res.data) > 0
    except Exception as e:
        print(f"Supabase user_exists error: {e}")
        users = _load_local_users()
        return email.lower() in users

def get_user_by_email(email: str):
    try:
        client = get_supabase_client()
        res = client.table("users").select("*").eq("email", email.lower()).execute()
        if res.data:
            return res.data[0]
    except Exception as e:
        print(f"Supabase get_user_by_email error: {e}")
        users = _load_local_users()
        return users.get(email.lower())

def create_user(email: str, mobile: str, password_hash: str, recovery_question: str = None, recovery_answer_hash: str = None):
    try:
        client = get_supabase_client()
        user_data = {
            "email": email.lower(),
            "mobile": mobile,
            "password_hash": password_hash,
            "recovery_question": recovery_question,
            "recovery_answer_hash": recovery_answer_hash,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        client.table("users").insert(user_data).execute()
        # Create default profile to ensure referential integrity
        profile_data = {
            "email": email.lower(),
            "name": "",
            "target_role": "",
            "resume_name": "",
            "resume_text": "",
            "location": "",
            "projects": "",
            "hackathons": "",
            "goals": "",
            "availability": "",
            "discoverable": True,
            "following": [],
            "followers": [],
            "photo_url": ""
        }
        client.table("profiles").insert(profile_data).execute()
    except Exception as e:
        print(f"Supabase create_user error: {e}")
    
    # Local fallback
    users = _load_local_users()
    users[email.lower()] = {
        "email": email.lower(),
        "mobile": mobile,
        "password_hash": password_hash,
        "recovery_question": recovery_question,
        "recovery_answer_hash": recovery_answer_hash,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    _save_local_users(users)

def update_password(email: str, new_password_hash: str):
    try:
        client = get_supabase_client()
        client.table("users").update({"password_hash": new_password_hash}).eq("email", email.lower()).execute()
        return True
    except Exception as e:
        print(f"Supabase update_password error: {e}")
        
    users = _load_local_users()
    if email.lower() in users:
        users[email.lower()]["password_hash"] = new_password_hash
        _save_local_users(users)
        return True
    return False

