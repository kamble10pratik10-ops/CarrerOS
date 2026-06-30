import os
from supabase import create_client, Client

_supabase_client = None

def get_supabase_client() -> Client | None:
    global _supabase_client
    if _supabase_client is None:
        url = (os.environ.get("SUPABASE_URL") or "").strip()
        key = (os.environ.get("SUPABASE_KEY") or "").strip()
        if not url or not key or "your_supabase" in url or "your_supabase" in key:
            print("SUPABASE_URL and SUPABASE_KEY must be configured in backend .env to migrate to Supabase. Using local storage fallback.")
            return None
        _supabase_client = create_client(url, key)
    return _supabase_client
