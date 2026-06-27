import os
import json
from datetime import datetime, timezone

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
USERS_DB_PATH = os.path.join(CURRENT_DIR, 'users.json')

def init_users_db():
    if not os.path.exists(USERS_DB_PATH):
        with open(USERS_DB_PATH, 'w', encoding='utf-8') as f:
            json.dump({"users": []}, f, indent=2)

def get_all_users():
    init_users_db()
    try:
        with open(USERS_DB_PATH, 'r', encoding='utf-8') as f:
            return json.load(f).get("users", [])
    except Exception:
        return []

def user_exists(email: str) -> bool:
    return any(u["email"].lower() == email.lower() for u in get_all_users())

def get_user_by_email(email: str):
    return next((u for u in get_all_users() if u["email"].lower() == email.lower()), None)

def create_user(email: str, mobile: str, password_hash: str):
    init_users_db()
    with open(USERS_DB_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    data["users"].append({
        "email": email.lower(),
        "mobile": mobile,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    with open(USERS_DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
