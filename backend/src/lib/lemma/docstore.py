import os
import json
from .datastore import init_db, DB_PATH

def get_resume():
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        profile = data.get("profile")
        return profile.get("resume", "") if profile else ""
    except Exception as e:
        print(f"Error fetching resume from Lemma DocStore: {e}")
        return ""

def save_resume(resume_text):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not data.get("profile"):
            data["profile"] = {}
        data["profile"]["resume"] = resume_text
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving resume to Lemma DocStore: {e}")
        return False

def get_tailored_resume(app_id):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        applications = data.get("applications", [])
        for app in applications:
            if app.get("id") == app_id:
                return app.get("tailoredBullets", "")
        return ""
    except Exception as e:
        print(f"Error fetching tailored resume from Lemma DocStore: {e}")
        return ""

def save_tailored_resume(app_id, tailored_bullets):
    init_db()
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        applications = data.get("applications", [])
        index = -1
        for i, app in enumerate(applications):
            if app.get("id") == app_id:
                index = i
                break
        if index >= 0:
            applications[index]["tailoredBullets"] = tailored_bullets
            data["applications"] = applications
            with open(DB_PATH, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            return True
        return False
    except Exception as e:
        print(f"Error saving tailored resume to Lemma DocStore: {e}")
        return False
