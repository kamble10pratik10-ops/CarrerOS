import os
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

print("DEBUG KEY:", os.environ.get("GOOGLE_API_KEY"))
print("DEBUG GROQ:", os.environ.get("GROQ_API_KEY"))

from src.lib.lemma.datastore import (
    get_applications,
    get_weekly_velocity,
    get_active_nudges,
    update_application,
    delete_application,
    save_profile,
    get_profile
)
from src.lib.lemma.workflows import trigger_application_workflow
from src.services.ai_service import parse_file_with_gemini, chat_with_agent

app = FastAPI(title="CareerOS API", version="1.0.0")

# CORS middleware configuration matching Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    jdText: str
    resumeText: str
    companyName: str | None = None
    roleName: str | None = None

class UpdateRequest(BaseModel):
    id: str | None = None
    updates: dict | None = None
    profile: dict | None = None

class ChatRequest(BaseModel):
    message: str
    chatHistory: list | None = []
    resumeText: str | None = ""
    currentJdText: str | None = ""

# 1. File Upload / Parser Route (Gemini OCR & PDF Parsing)
@app.post("/api/parse-file")
async def parse_file(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()
        mime_type = file.content_type or ""
        file_name = file.filename or "unknown"
        
        print(f"[Backend] Processing file upload: {file_name} ({mime_type})")
        extracted_text = parse_file_with_gemini(file_bytes, mime_type, file_name)
        
        return {
            "success": True,
            "text": extracted_text,
            "fileName": file_name,
            "mimeType": mime_type
        }
    except Exception as e:
        print(f"Error in parse-file route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to parse file"
        )

# 2. Application Analysis Workflow Route (Groq + Gemini Triage Scorer)
@app.post("/api/analyze")
async def analyze_application(req: AnalyzeRequest):
    try:
        print("[Backend] Triggering analysis workflow...")
        saved_app = await trigger_application_workflow({
            "jdText": req.jdText,
            "resumeText": req.resumeText,
            "companyName": req.companyName,
            "roleName": req.roleName
        })
        
        weekly_velocity = get_weekly_velocity()
        active_nudges = get_active_nudges()
        all_apps = get_applications()
        
        return {
            "success": True,
            "application": saved_app,
            "weeklyVelocity": weekly_velocity,
            "activeNudges": active_nudges,
            "allApps": all_apps
        }
    except Exception as e:
        print(f"Error in analyze route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to analyze application"
        )

# 3. Get Application pipeline board and stats
@app.get("/api/analyze")
async def get_analysis_dashboard():
    try:
        all_apps = get_applications()
        weekly_velocity = get_weekly_velocity()
        active_nudges = get_active_nudges()
        
        return {
            "success": True,
            "applications": all_apps,
            "weeklyVelocity": weekly_velocity,
            "activeNudges": active_nudges
        }
    except Exception as e:
        print(f"Error fetching applications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch application states"
        )

# 4. Update application status or user profile
@app.put("/api/applications")
async def update_applications_or_profile(req: UpdateRequest):
    try:
        if req.profile is not None:
            print("[Backend] Updating user profile...")
            saved = save_profile(req.profile)
            return {"success": True, "profile": saved}
            
        if not req.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Application ID is required"
            )
            
        print(f"[Backend] Updating application status: {req.id}")
        updated_app = update_application(req.id, req.updates or {})
        
        if not updated_app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Application not found"
            )
            
        return {"success": True, "application": updated_app}
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error in applications PUT route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to update"
        )

# 5. Delete an application
@app.delete("/api/applications")
async def delete_app(id: str):
    try:
        print(f"[Backend] Deleting application {id}")
        success = delete_application(id)
        return {"success": success}
    except Exception as e:
        print(f"Error in applications DELETE route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete application"
        )

# 6. Conversational Chat Agent (Career Concierge)
@app.post("/api/chat")
async def chat(req: ChatRequest):
    try:
        print("[Backend] Forwarding message to Career Concierge...")
        reply = await chat_with_agent({
            "message": req.message,
            "chatHistory": req.chatHistory or [],
            "resumeText": req.resumeText,
            "currentJdText": req.currentJdText
        })
        
        return {
            "success": True,
            "reply": reply
        }
    except Exception as e:
        print(f"Error in chat API route: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "Failed to get response from AI chat"
        )

if __name__ == "__main__":
    import uvicorn
    # Use port 3001 to match Next.js frontend expectance
    uvicorn.run("main:app", host="127.0.0.1", port=3001, reload=True)
