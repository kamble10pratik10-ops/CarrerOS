import os
import json
import time
import uuid
from datetime import datetime, timedelta, timezone
from src.lib.supabase_client import get_supabase_client

# Keep this for backward compatibility flags if any component references it
USE_LEMMA = False

LOCAL_APPS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "local_data")
os.makedirs(LOCAL_APPS_DIR, exist_ok=True)

def _local_apps_path(user_email):
    safe = user_email.lower().replace("@", "_at_").replace(".", "_dot_")
    return os.path.join(LOCAL_APPS_DIR, f"apps_{safe}.json")

def _save_app_to_local(user_email, app_data):
    try:
        path = _local_apps_path(user_email)
        apps = []
        if os.path.exists(path):
            with open(path, "r") as f:
                apps = json.load(f)
        existing_idx = next((i for i, a in enumerate(apps) if a.get("id") == app_data.get("id")), None)
        if existing_idx is not None:
            apps[existing_idx] = app_data
        else:
            apps.append(app_data)
        with open(path, "w") as f:
            json.dump(apps, f, indent=2)
    except Exception as e:
        print(f"Local app save error: {e}")

def _get_local_apps(user_email):
    try:
        path = _local_apps_path(user_email)
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
    except Exception as e:
        print(f"Local app read error: {e}")
    return []

def _local_profile_path(user_email):
    safe = user_email.lower().replace("@", "_at_").replace(".", "_dot_")
    return os.path.join(LOCAL_APPS_DIR, f"profile_{safe}.json")

def _save_profile_to_local(user_email, profile):
    try:
        path = _local_profile_path(user_email)
        with open(path, "w") as f:
            json.dump(profile, f, indent=2)
    except Exception as e:
        print(f"Local profile save error: {e}")

def _get_local_profile(user_email):
    try:
        path = _local_profile_path(user_email)
        if os.path.exists(path):
            with open(path, "r") as f:
                return json.load(f)
    except Exception as e:
        print(f"Local profile read error: {e}")
    return None

def get_user_data(user_email: str):
    client = get_supabase_client()
    user_email = user_email.lower()
    try:
        # Get profile
        profile_res = client.table("profiles").select("*").eq("email", user_email).execute()
        profile = None
        if profile_res.data:
            r = profile_res.data[0]
            profile = {
                "name": r.get("name", ""),
                "targetRole": r.get("target_role", ""),
                "resumeName": r.get("resume_name", ""),
                "resumeText": r.get("resume_text", ""),
                "location": r.get("location", ""),
                "projects": r.get("projects", ""),
                "hackathons": r.get("hackathons", ""),
                "goals": r.get("goals", ""),
                "availability": r.get("availability", ""),
                "discoverable": r.get("discoverable", True),
                "following": r.get("following") or [],
                "followers": r.get("followers") or [],
                "photoUrl": r.get("photo_url") or "",
                "resume": r.get("resume_text", "")
            }
        
        # Get applications
        apps_res = client.table("applications").select("*").eq("user_email", user_email).execute()
        apps = []
        for app in (apps_res.data or []):
            apps.append({
                "id": app["id"],
                "company": app.get("company", "Unknown Company"),
                "role": app.get("role", "Software Engineer"),
                "status": app.get("status", "Applied"),
                "dateApplied": app.get("date_applied"),
                "matchScore": app.get("match_score", 50),
                "effort": app.get("effort", "Medium"),
                "flag": app.get("flag", "Green"),
                "flagReason": app.get("flag_reason", ""),
                "jdText": app.get("jd_text", ""),
                "tailoredBullets": app.get("tailored_bullets", "[]"),
                "outreachMessages": app.get("outreach_messages") or {"confident": "", "curious": "", "concise": ""},
                "interviewQuestions": app.get("interview_questions") or [],
                "nudge3Dismissed": app.get("nudge3_dismissed", False),
                "nudge7Dismissed": app.get("nudge7_dismissed", False),
                "gaps": app.get("gaps") or [],
                "learningResources": app.get("learning_resources") or []
            })
        return {"applications": apps, "profile": profile}, {}
    except Exception as e:
        print(f"Supabase get_user_data error: {e}")
        return {"applications": [], "profile": None}, {}

def save_user_data(user_email: str, user_dict, full_data):
    if "profile" in user_dict:
        save_profile(user_email, user_dict["profile"])
        return True
    return False

def get_applications(user_email: str):
    user_email = user_email.lower()
    try:
        client = get_supabase_client()
        res = client.table("applications").select("*").eq("user_email", user_email).execute()
        apps = []
        for app in (res.data or []):
            apps.append({
                "id": app["id"],
                "company": app.get("company", "Unknown Company"),
                "role": app.get("role", "Software Engineer"),
                "status": app.get("status", "Applied"),
                "dateApplied": app.get("date_applied"),
                "matchScore": app.get("match_score", 50),
                "effort": app.get("effort", "Medium"),
                "flag": app.get("flag", "Green"),
                "flagReason": app.get("flag_reason", ""),
                "jdText": app.get("jd_text", ""),
                "tailoredBullets": app.get("tailored_bullets") or "[]",
                "outreachMessages": app.get("outreach_messages") or {"confident": "", "curious": "", "concise": ""},
                "interviewQuestions": app.get("interview_questions") or [],
                "nudge3Dismissed": app.get("nudge3_dismissed", False),
                "nudge7Dismissed": app.get("nudge7_dismissed", False),
                "gaps": app.get("gaps") or [],
                "learningResources": app.get("learning_resources") or []
            })
        return apps
    except Exception as e:
        print(f"Supabase get_applications error: {e}")
        local_apps = _get_local_apps(user_email)
        if local_apps:
            print(f"Returning {len(local_apps)} locally cached applications for {user_email}")
        return local_apps

def save_application(user_email: str, app):
    app_id = app.get("id") or f"app_{int(datetime.now().timestamp() * 1000)}"
    user_email = user_email.lower()
    
    date_applied = app.get("dateApplied") or app.get("date_applied") or datetime.utcnow().isoformat() + "Z"
    
    db_app = {
        "id": app_id,
        "user_email": user_email,
        "company": app.get("company", "Unknown Company"),
        "role": app.get("role", "Software Engineer"),
        "status": app.get("status", "Applied"),
        "date_applied": date_applied,
        "match_score": app.get("matchScore") if app.get("matchScore") is not None else app.get("match_score", 50),
        "effort": app.get("effort", "Medium"),
        "flag": app.get("flag", "Green"),
        "flag_reason": app.get("flagReason") or app.get("flag_reason", ""),
        "jd_text": app.get("jdText") or app.get("jd_text", ""),
        "tailored_bullets": app.get("tailoredBullets") or app.get("tailored_bullets", "[]"),
        "outreach_messages": app.get("outreachMessages") or app.get("outreach_messages") or {"confident": "", "curious": "", "concise": ""},
        "interview_questions": app.get("interviewQuestions") or app.get("interview_questions") or [],
        "nudge3_dismissed": app.get("nudge3Dismissed") if app.get("nudge3Dismissed") is not None else app.get("nudge3_dismissed", False),
        "nudge7_dismissed": app.get("nudge7Dismissed") if app.get("nudge7Dismissed") is not None else app.get("nudge7_dismissed", False),
        "gaps": app.get("gaps") or [],
        "learning_resources": app.get("learningResources") or app.get("learning_resources") or []
    }
    
    # Always persist locally as fallback
    local_app_entry = {
        "id": app_id,
        "company": db_app["company"],
        "role": db_app["role"],
        "status": db_app["status"],
        "dateApplied": date_applied,
        "matchScore": db_app["match_score"],
        "effort": db_app["effort"],
        "flag": db_app["flag"],
        "flagReason": db_app["flag_reason"],
        "jdText": db_app["jd_text"],
        "tailoredBullets": db_app["tailored_bullets"],
        "outreachMessages": db_app["outreach_messages"],
        "interviewQuestions": db_app["interview_questions"],
        "nudge3Dismissed": db_app["nudge3_dismissed"],
        "nudge7Dismissed": db_app["nudge7_dismissed"],
        "gaps": db_app["gaps"],
        "learningResources": db_app["learning_resources"]
    }
    _save_app_to_local(user_email, local_app_entry)
    
    try:
        client = get_supabase_client()
        try:
            existing = client.table("applications").select("id").eq("id", app_id).execute()
            exists = len(existing.data) > 0
        except:
            exists = False
            
        if exists:
            res = client.table("applications").update(db_app).eq("id", app_id).execute()
        else:
            res = client.table("applications").insert(db_app).execute()
            
        if res.data:
            r = res.data[0]
            return {
                "id": r["id"],
                "company": r["company"],
                "role": r["role"],
                "status": r["status"],
                "dateApplied": r["date_applied"],
                "matchScore": r["match_score"],
                "effort": r["effort"],
                "flag": r["flag"],
                "flagReason": r["flag_reason"],
                "jdText": r["jd_text"],
                "tailoredBullets": r["tailored_bullets"] or "[]",
                "outreachMessages": r["outreach_messages"],
                "interviewQuestions": r["interview_questions"],
                "nudge3Dismissed": r["nudge3_dismissed"],
                "nudge7Dismissed": r["nudge7_dismissed"],
                "gaps": r["gaps"],
                "learningResources": r["learning_resources"]
            }
    except Exception as e:
        print(f"Supabase save_application error: {e}")
    
    return local_app_entry

def update_application(user_email: str, id, updates):
    client = get_supabase_client()
    db_updates = {}
    
    mapping = {
        "company": "company",
        "role": "role",
        "status": "status",
        "dateApplied": "date_applied",
        "date_applied": "date_applied",
        "matchScore": "match_score",
        "match_score": "match_score",
        "effort": "effort",
        "flag": "flag",
        "flagReason": "flag_reason",
        "flag_reason": "flag_reason",
        "jdText": "jd_text",
        "jd_text": "jd_text",
        "tailoredBullets": "tailored_bullets",
        "tailored_bullets": "tailored_bullets",
        "outreachMessages": "outreach_messages",
        "outreach_messages": "outreach_messages",
        "interviewQuestions": "interview_questions",
        "interview_questions": "interview_questions",
        "nudge3Dismissed": "nudge3_dismissed",
        "nudge3_dismissed": "nudge3_dismissed",
        "nudge7Dismissed": "nudge7_dismissed",
        "nudge7_dismissed": "nudge7_dismissed",
        "gaps": "gaps",
        "learningResources": "learning_resources",
        "learning_resources": "learning_resources"
    }
    
    for k, v in updates.items():
        if k in mapping:
            db_updates[mapping[k]] = v
        else:
            db_updates[k] = v
            
    try:
        res = client.table("applications").update(db_updates).eq("id", id).execute()
        if res.data:
            r = res.data[0]
            return {
                "id": r["id"],
                "company": r["company"],
                "role": r["role"],
                "status": r["status"],
                "dateApplied": r["date_applied"],
                "matchScore": r["match_score"],
                "effort": r["effort"],
                "flag": r["flag"],
                "flagReason": r["flag_reason"],
                "jdText": r["jd_text"],
                "tailoredBullets": r["tailored_bullets"],
                "outreachMessages": r["outreach_messages"],
                "interviewQuestions": r["interview_questions"],
                "nudge3Dismissed": r["nudge3_dismissed"],
                "nudge7Dismissed": r["nudge7_dismissed"],
                "gaps": r["gaps"],
                "learningResources": r["learning_resources"]
            }
    except Exception as e:
        print(f"Supabase update_application error: {e}")
    return None

def delete_application(user_email: str, id):
    client = get_supabase_client()
    try:
        client.table("applications").delete().eq("id", id).execute()
        return True
    except Exception as e:
        print(f"Supabase delete_application error: {e}")
        return False

def get_profile(user_email: str):
    client = get_supabase_client()
    try:
        res = client.table("profiles").select("*").eq("email", user_email.lower()).execute()
        if res.data:
            r = res.data[0]
            return {
                "name": r.get("name", ""),
                "targetRole": r.get("target_role", ""),
                "resumeName": r.get("resume_name", ""),
                "resumeText": r.get("resume_text", ""),
                "location": r.get("location", ""),
                "projects": r.get("projects", ""),
                "hackathons": r.get("hackathons", ""),
                "goals": r.get("goals", ""),
                "availability": r.get("availability", ""),
                "discoverable": r.get("discoverable", True),
                "following": r.get("following") or [],
                "followers": r.get("followers") or [],
                "photoUrl": r.get("photo_url") or "",
                "resume": r.get("resume_text", "")
            }
    except Exception as e:
        print(f"Supabase get_profile error: {e}")
    
    # Fallback to local
    return _get_local_profile(user_email)

def save_profile(user_email: str, profile):
    client = get_supabase_client()
    user_email = user_email.lower()
    db_profile = {
        "email": user_email,
        "name": profile.get("name", ""),
        "target_role": profile.get("targetRole") or profile.get("target_role", ""),
        "resume_name": profile.get("resumeName") or profile.get("resume_name", ""),
        "resume_text": profile.get("resumeText") or profile.get("resume_text") or profile.get("resume", ""),
        "location": profile.get("location", ""),
        "projects": profile.get("projects", ""),
        "hackathons": profile.get("hackathons", ""),
        "goals": profile.get("goals", ""),
        "availability": profile.get("availability", ""),
        "discoverable": profile.get("discoverable") if profile.get("discoverable") is not None else True,
        "following": profile.get("following") or [],
        "followers": profile.get("followers") or [],
        "photo_url": profile.get("photoUrl") or profile.get("photo_url") or ""
    }
    
    # Always persist locally as fallback
    _save_profile_to_local(user_email, profile)
    
    try:
        existing = client.table("profiles").select("email").eq("email", user_email).execute()
        exists = len(existing.data) > 0
    except:
        exists = False
        
    try:
        user_check = client.table("users").select("email").eq("email", user_email).execute()
        if len(user_check.data) == 0:
            client.table("users").insert({
                "email": user_email,
                "mobile": "0000000000",
                "password_hash": "recovered",
                "created_at": datetime.now(timezone.utc).isoformat()
            }).execute()
    except Exception as e:
        print(f"Supabase user recovery error: {e}")
        
    try:
        if exists:
            res = client.table("profiles").update(db_profile).eq("email", user_email).execute()
        else:
            res = client.table("profiles").insert(db_profile).execute()
        if res.data:
            return profile
    except Exception as e:
        print(f"Supabase save_profile error: {e}")
    return profile

def get_weekly_velocity(user_email: str):
    apps = get_applications(user_email)
    now = datetime.utcnow()
    one_week_ago = now - timedelta(days=7)
    count = 0
    for app in apps:
        date_str = app.get("dateApplied", "")
        if not date_str: continue
        try:
            clean = date_str.rstrip('Z')
            date_obj = datetime.fromisoformat(clean.split('.')[0] if '.' in clean else clean)
            if date_obj >= one_week_ago: count += 1
        except: pass
    return count

def get_active_nudges(user_email: str):
    apps = get_applications(user_email)
    now = datetime.utcnow()
    nudges = []
    for app in apps:
        if app.get("status") not in ["Applied", "Screening"]: continue
        date_str = app.get("dateApplied", "")
        if not date_str: continue
        try:
            clean = date_str.rstrip('Z')
            date_obj = datetime.fromisoformat(clean.split('.')[0] if '.' in clean else clean)
            diff_days = (now - date_obj).days
            if diff_days >= 3 and diff_days < 7 and not app.get("nudge3Dismissed", False):
                nudges.append({"id": f"{app.get('id')}_nudge_3", "appId": app.get("id"), "company": app.get("company"), "role": app.get("role"), "type": "Day 3 Nudge", "message": f"It has been {diff_days} days since you applied to {app.get('company')}. Time to send a gentle LinkedIn follow-up!"})
            if diff_days >= 7 and not app.get("nudge7Dismissed", False):
                nudges.append({"id": f"{app.get('id')}_nudge_7", "appId": app.get("id"), "company": app.get("company"), "role": app.get("role"), "type": "Day 7 Nudge", "message": f"It's been a week since you applied to {app.get('company')}. Consider reaching out to the hiring manager or recruiter again."})
        except: pass
    return nudges

def get_discoverable_profiles(exclude_email: str):
    client = get_supabase_client()
    try:
        res = client.table("profiles").select("*").eq("discoverable", True).neq("email", exclude_email.lower()).execute()
        profiles = []
        for r in (res.data or []):
            profiles.append({
                "email": r.get("email"),
                "name": r.get("name", ""),
                "targetRole": r.get("target_role", ""),
                "resumeName": r.get("resume_name", ""),
                "resumeText": r.get("resume_text", ""),
                "location": r.get("location", ""),
                "projects": r.get("projects", ""),
                "hackathons": r.get("hackathons", ""),
                "goals": r.get("goals", ""),
                "availability": r.get("availability", ""),
                "discoverable": r.get("discoverable", True),
                "following": r.get("following") or [],
                "followers": r.get("followers") or [],
                "photoUrl": r.get("photo_url") or ""
            })
        return profiles
    except Exception as e:
        print(f"Supabase get_discoverable_profiles error: {e}")
        return []

def follow_user(follower_email, target_email):
    client = get_supabase_client()
    try:
        follower_res = client.table("profiles").select("following").eq("email", follower_email.lower()).execute()
        follower_following = set(follower_res.data[0].get("following") or []) if follower_res.data else set()
        follower_following.add(target_email.lower())
        
        target_res = client.table("profiles").select("followers").eq("email", target_email.lower()).execute()
        target_followers = set(target_res.data[0].get("followers") or []) if target_res.data else set()
        target_followers.add(follower_email.lower())
        
        client.table("profiles").update({"following": list(follower_following)}).eq("email", follower_email.lower()).execute()
        client.table("profiles").update({"followers": list(target_followers)}).eq("email", target_email.lower()).execute()
        return True
    except Exception as e:
        print(f"Supabase follow_user error: {e}")
        return False

def unfollow_user(follower_email, target_email):
    client = get_supabase_client()
    try:
        follower_res = client.table("profiles").select("following").eq("email", follower_email.lower()).execute()
        follower_following = set(follower_res.data[0].get("following") or []) if follower_res.data else set()
        if target_email.lower() in follower_following:
            follower_following.remove(target_email.lower())
        
        target_res = client.table("profiles").select("followers").eq("email", target_email.lower()).execute()
        target_followers = set(target_res.data[0].get("followers") or []) if target_res.data else set()
        if follower_email.lower() in target_followers:
            target_followers.remove(follower_email.lower())
            
        client.table("profiles").update({"following": list(follower_following)}).eq("email", follower_email.lower()).execute()
        client.table("profiles").update({"followers": list(target_followers)}).eq("email", target_email.lower()).execute()
        return True
    except Exception as e:
        print(f"Supabase unfollow_user error: {e}")
        return False

def search_profiles(query, exclude_email):
    client = get_supabase_client()
    try:
        res = client.table("profiles").select("*").eq("discoverable", True).neq("email", exclude_email.lower()).ilike("name", f"%{query}%").execute()
        profiles = []
        for r in (res.data or []):
            profiles.append({
                "email": r.get("email"),
                "name": r.get("name", ""),
                "targetRole": r.get("target_role", ""),
                "resumeName": r.get("resume_name", ""),
                "resumeText": r.get("resume_text", ""),
                "location": r.get("location", ""),
                "projects": r.get("projects", ""),
                "hackathons": r.get("hackathons", ""),
                "goals": r.get("goals", ""),
                "availability": r.get("availability", ""),
                "discoverable": r.get("discoverable", True),
                "following": r.get("following") or [],
                "followers": r.get("followers") or [],
                "photoUrl": r.get("photo_url") or ""
            })
        return profiles
    except Exception as e:
        print(f"Supabase search_profiles error: {e}")
        return []

def get_profiles_by_emails(emails):
    client = get_supabase_client()
    emails_lower = [e.lower() for e in emails]
    try:
        res = client.table("profiles").select("*").in_("email", emails_lower).execute()
        profiles = []
        for r in (res.data or []):
            profiles.append({
                "email": r.get("email"),
                "name": r.get("name", ""),
                "targetRole": r.get("target_role", ""),
                "resumeName": r.get("resume_name", ""),
                "resumeText": r.get("resume_text", ""),
                "location": r.get("location", ""),
                "projects": r.get("projects", ""),
                "hackathons": r.get("hackathons", ""),
                "goals": r.get("goals", ""),
                "availability": r.get("availability", ""),
                "discoverable": r.get("discoverable", True),
                "following": r.get("following") or [],
                "followers": r.get("followers") or [],
                "photoUrl": r.get("photo_url") or ""
            })
        return profiles
    except Exception as e:
        print(f"Supabase get_profiles_by_emails error: {e}")
        return []

def get_chat_room_id(email1, email2):
    emails = sorted([email1.lower(), email2.lower()])
    return f"{emails[0]}_{emails[1]}"

def save_chat_message(sender, receiver, text, media_urls=None):
    client = get_supabase_client()
    room_id = get_chat_room_id(sender, receiver)
    msg_id = f"msg_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}"
    msg = {
        "id": msg_id,
        "room_id": room_id,
        "sender": sender.lower(),
        "receiver": receiver.lower(),
        "text": text,
        "media_urls": media_urls or [],
        "timestamp": int(time.time() * 1000)
    }
    try:
        res = client.table("chats").insert(msg).execute()
        if res.data:
            r = res.data[0]
            return {
                "id": r["id"],
                "sender": r["sender"],
                "receiver": r["receiver"],
                "text": r["text"],
                "mediaUrls": r["media_urls"],
                "timestamp": r["timestamp"]
            }
    except Exception as e:
        print(f"Supabase save_chat_message error: {e}")
    return None

def get_chat_history(user1, user2):
    client = get_supabase_client()
    room_id = get_chat_room_id(user1, user2)
    try:
        res = client.table("chats").select("*").eq("room_id", room_id).order("timestamp").execute()
        history = []
        for r in (res.data or []):
            history.append({
                "id": r["id"],
                "sender": r["sender"],
                "receiver": r["receiver"],
                "text": r["text"],
                "mediaUrls": r["media_urls"],
                "timestamp": r["timestamp"]
            })
        return history
    except Exception as e:
        print(f"Supabase get_chat_history error: {e}")
        return []

def get_conversations(email):
    client = get_supabase_client()
    email_lower = email.lower()
    try:
        res = client.table("chats").select("*").or_(f"sender.eq.{email_lower},receiver.eq.{email_lower}").order("timestamp", desc=True).execute()
        convos = {}
        for r in (res.data or []):
            other = r["sender"] if r["receiver"] == email_lower else r["receiver"]
            if other not in convos:
                convos[other] = {
                    "lastMessage": r["text"],
                    "timestamp": r["timestamp"],
                    "sender": r["sender"]
                }
        sorted_c = sorted(convos.items(), key=lambda x: x[1]["timestamp"], reverse=True)
        return [{"email": e, **d} for e, d in sorted_c]
    except Exception as e:
        print(f"Supabase get_conversations error: {e}")
        return []

def get_companies(search=""):
    client = get_supabase_client()
    try:
        query = client.table("companies").select("*")
        if search:
            q = f"%{search}%"
            query = query.or_(f"name.ilike.{q},industry.ilike.{q},location.ilike.{q}")
        res = query.execute()
        return res.data or []
    except Exception as e:
        print(f"Supabase get_companies error: {e}")
        return []

def save_company_interest(user_email, company_id):
    client = get_supabase_client()
    try:
        interest = {
            "user_email": user_email.lower(),
            "company_id": company_id
        }
        client.table("company_interests").insert(interest).execute()
        return True
    except Exception as e:
        print(f"Supabase save_company_interest error: {e}")
        return False

def get_user_company_interests(user_email):
    client = get_supabase_client()
    try:
        res = client.table("company_interests").select("company_id").eq("user_email", user_email.lower()).execute()
        return [r["company_id"] for r in (res.data or [])]
    except Exception as e:
        print(f"Supabase get_user_company_interests error: {e}")
        return []

