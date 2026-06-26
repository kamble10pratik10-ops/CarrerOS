import os
import json
from .datastore import init_db, DB_PATH, get_user_data, save_user_data

def get_resume(user_email: str):
    user_dict, _ = get_user_data(user_email)
    profile = user_dict.get("profile")
    return profile.get("resume", "") if profile else ""

def save_resume(user_email: str, resume_text):
    user_dict, full_data = get_user_data(user_email)
    if not user_dict.get("profile"):
        user_dict["profile"] = {}
    user_dict["profile"]["resume"] = resume_text
    return save_user_data(user_email, user_dict, full_data)

def get_tailored_resume(user_email: str, app_id):
    user_dict, _ = get_user_data(user_email)
    applications = user_dict.get("applications", [])
    for app in applications:
        if app.get("id") == app_id:
            return app.get("tailoredBullets", "")
    return ""

def save_tailored_resume(user_email: str, app_id, tailored_bullets):
    user_dict, full_data = get_user_data(user_email)
    applications = user_dict.get("applications", [])
    index = -1
    for i, app in enumerate(applications):
        if app.get("id") == app_id:
            index = i
            break
    if index >= 0:
        applications[index]["tailoredBullets"] = tailored_bullets
        user_dict["applications"] = applications
        return save_user_data(user_email, user_dict, full_data)
    return False
