import os
from .datastore import get_user_data, save_user_data, get_applications, update_application, USE_LEMMA

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
    apps = get_applications(user_email)
    for app in apps:
        if app.get("id") == app_id:
            return app.get("tailoredBullets", "")
    return ""

def save_tailored_resume(user_email: str, app_id, tailored_bullets):
    return update_application(user_email, app_id, {"tailoredBullets": tailored_bullets})
