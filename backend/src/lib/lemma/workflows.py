import json
from datetime import datetime
from .datastore import save_application
from .docstore import save_tailored_resume

async def trigger_application_workflow(user_email: str, payload):
    try:
        # Import the AI service function inside the trigger function to avoid circular dependency
        from ...services.ai_service import generate_application_analysis
        
        jd_text = payload.get("jdText")
        resume_text = payload.get("resumeText")
        company_name = payload.get("companyName")
        role_name = payload.get("roleName")
        
        print(f"[Lemma Workflows] Starting workflow for {role_name or 'Unknown Role'} at {company_name or 'Unknown Company'} for {user_email}")
        
        # 2. Run AI reasoning
        analysis_result = await generate_application_analysis({
            "jdText": jd_text,
            "resumeText": resume_text,
            "companyName": company_name,
            "roleName": role_name
        })
        
        # 3. Construct application entry
        signal_score = analysis_result.get("signalScore") or {}
        app_entry = {
            "id": f"app_{int(datetime.utcnow().timestamp() * 1000)}",
            "company": analysis_result.get("company") or company_name or "Unknown Company",
            "role": analysis_result.get("role") or role_name or "Software Engineer",
            "status": "Applied",  # default Kanban column
            "dateApplied": datetime.utcnow().isoformat() + "Z",
            "matchScore": signal_score.get("fitScore", 50),
            "effort": signal_score.get("effort", "Medium"),
            "flag": signal_score.get("flag", "Green"),
            "flagReason": signal_score.get("flagReason", ""),
            "jdText": jd_text,
            "tailoredBullets": json.dumps(analysis_result.get("tailoredBullets", [])),
            "outreachMessages": analysis_result.get("outreachMessages") or {"confident": "", "curious": "", "concise": ""},
            "learningResources": analysis_result.get("learningResources") or [],
            "gaps": analysis_result.get("gaps") or [],
            "nudge3Dismissed": False,
            "nudge7Dismissed": False
        }
        
        # 4. Save to DataStore & DocStore
        saved_app = save_application(user_email, app_entry)
        if saved_app:
            save_tailored_resume(user_email, saved_app["id"], app_entry["tailoredBullets"])
            
        return saved_app
    except Exception as e:
        print(f"[Lemma Workflows] Workflow execution failed: {e}")
        raise e
