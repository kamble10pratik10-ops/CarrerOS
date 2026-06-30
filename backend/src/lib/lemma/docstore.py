from .datastore import get_profile, save_profile, get_applications, update_application

def get_resume(user_email: str):
    profile = get_profile(user_email)
    return profile.get("resume", "") if profile else ""

def save_resume(user_email: str, resume_text):
    profile = get_profile(user_email) or {}
    profile["resume"] = resume_text
    profile["resumeText"] = resume_text
    return save_profile(user_email, profile) is not None

def get_tailored_resume(user_email: str, app_id):
    apps = get_applications(user_email)
    for app in apps:
        if app.get("id") == app_id:
            return app.get("tailoredBullets", "")
    return ""

def save_tailored_resume(user_email: str, app_id, tailored_bullets):
    return update_application(user_email, app_id, {"tailoredBullets": tailored_bullets})

