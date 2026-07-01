import json
import os
import asyncio
import traceback
import time
from typing import Dict, Any, List

# Attempt to import real Lemma SDK
# try:
#     from lemma_sdk import Pod
#     has_lemma = True
# except ImportError:
#     has_lemma = False
#     print("[lemma_orchestrator] WARNING: lemma-sdk is not installed or requires Python >= 3.11.")
#     print("[lemma_orchestrator] Authentic Lemma orchestration disabled. Falling back to local Groq execution.")
try:
    from lemma_sdk import Pod
    has_lemma = True
    print("✅ Lemma SDK imported successfully")
except Exception as e:
    has_lemma = False
    print("❌ Lemma SDK import failed")
    print(type(e))
    print(e)

from src.services.ats_scorer import calculate_ats_score

# ==========================================
# AUTO-REFRESH LOGIC
# ==========================================
def refresh_lemma_token():
    print("[lemma_orchestrator] Token expired! Attempting to refresh...")
    refresh_token = os.getenv("LEMMA_REFRESH_TOKEN")
    
    # If not in env (e.g. local dev), try to load from CLI config
    if not refresh_token:
        try:
            import json
            from pathlib import Path
            config_path = Path.home() / ".lemma" / "config.json"
            if config_path.exists():
                with open(config_path, "r") as f:
                    config = json.load(f)
                    active_server = config.get("active_server", "cloud")
                    server_config = config.get("servers", {}).get(active_server, {})
                    refresh_token = server_config.get("refresh_token")
        except Exception as e:
            print(f"[lemma_orchestrator] Failed to read CLI config for refresh token: {e}")

    if not refresh_token:
        raise Exception("No LEMMA_REFRESH_TOKEN found in environment or local CLI config.")

    base_url = os.getenv("LEMMA_BASE_URL", "https://api.lemma.work")
    import requests
    response = requests.post(
        f"{base_url.rstrip('/')}/auth/cli/refresh",
        json={"refresh_token": refresh_token},
        headers={"Accept": "application/json"}
    )
    
    if response.status_code >= 400:
        raise Exception(f"Failed to refresh token: {response.text}")
        
    data = response.json()
    new_token = data.get("access_token") or data.get("token")
    new_refresh = data.get("refresh_token")
    
    if new_token:
        os.environ["LEMMA_TOKEN"] = new_token
    if new_refresh:
        os.environ["LEMMA_REFRESH_TOKEN"] = new_refresh
        
    # Persist back to local CLI config if it exists
    try:
        from pathlib import Path
        import json
        config_path = Path.home() / ".lemma" / "config.json"
        if config_path.exists() and new_token:
            with open(config_path, "r") as f:
                config = json.load(f)
            active = config.get("active_server", "cloud")
            if active in config.get("servers", {}):
                config["servers"][active]["token"] = new_token
                if "auth" in config["servers"][active]:
                    config["servers"][active]["auth"]["access_token"] = new_token
                if new_refresh:
                    config["servers"][active]["refresh_token"] = new_refresh
                    if "auth" in config["servers"][active]:
                        config["servers"][active]["auth"]["refresh_token"] = new_refresh
                with open(config_path, "w") as f:
                    json.dump(config, f, indent=2)
    except Exception:
        pass

    print("[lemma_orchestrator] Successfully refreshed Lemma token!")


# ==========================================
# LOCAL FALLBACK EXECUTORS
# ==========================================
# These execute locally using Groq when the authentic Lemma SDK cannot be reached.

async def local_mentor_workflow(profile: dict, resume_text: str, chat_history: list, message: str, groq_client) -> str:
    unified_context = f"""
    USER PROFILE:
    Target Role: {profile.get('targetRole', 'Not set')}
    Skills: {profile.get('skills', 'Not specified')}
    Resume Summary: {resume_text[:1000] if resume_text else 'No resume uploaded'}
    """
    
    system_prompt = f"""
    You are an elite AI Career Mentor.
    
    {unified_context}
    
    Instructions:
    1. Provide actionable, concise advice (2-4 paragraphs).
    2. Suggest specific technologies, companies, or strategies.
    3. Be direct and honest.
    """
    
    messages = [{"role": "system", "content": system_prompt}]
    for h in chat_history:
        messages.append({"role": h.get("role"), "content": h.get("content")})
    messages.append({"role": "user", "content": message})
    
    if groq_client:
        completion = groq_client.chat.completions.create(
            messages=messages,
            model="llama-3.3-70b-versatile"
        )
        return completion.choices[0].message.content
    return "API Client not provided."


async def local_resume_workflow(jd_text: str, resume_text: str, company_name: str, role_name: str, groq_client) -> Dict[str, Any]:
    print(f"[lemma_orchestrator] Starting local fallback Resume Analysis Pipeline for {role_name} at {company_name}...")

    # Step 1: ATS Scoring Engine
    ats_score, ats_factors = calculate_ats_score(resume_text, jd_text)
    
    # Step 2: Identify Gaps
    gap_prompt = f"""
    Analyze the Job Description and the Resume.
    JOB DESCRIPTION: {jd_text}
    RESUME: {resume_text}
    
    Task: Identify exactly 3 gaps between the resume and JD.
    Return ONLY valid JSON:
    {{
      "gaps": [
        {{"type": "MISSING KEYWORD", "text": "gap description"}},
        {{"type": "SKILL MISMATCH", "text": "mismatch description"}},
        {{"type": "OPPORTUNITY", "text": "opportunity description"}}
      ]
    }}
    """
    gap_completion = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": gap_prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    gaps_data = json.loads(gap_completion.choices[0].message.content)
    
    # Step 3: Suggest Improvements
    imp_prompt = f"""
    Based on this resume and job description, rewrite 3 bullet points to better match the JD and highlight achievements.
    Do not fabricate experience.
    
    JOB DESCRIPTION: {jd_text}
    RESUME: {resume_text[:2000]}
    
    Return ONLY valid JSON:
    {{
      "tailoredBullets": [
        {{
          "original": "Original text",
          "tailored": "Rewritten text",
          "reason": "Why this is better"
        }}
      ]
    }}
    """
    imp_completion = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": imp_prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    improvements_data = json.loads(imp_completion.choices[0].message.content)
    
    # Step 4: Generate Outreach
    out_prompt = f"""
    Draft 3 short recruiter outreach messages for this role:
    Company: {company_name}
    Role: {role_name}
    
    Also provide 1-2 learning resources for missing skills.
    
    Return ONLY valid JSON:
    {{
      "outreachMessages": {{
        "confident": "Bold message",
        "curious": "Eager message",
        "concise": "Short message"
      }},
      "learningResources": [
        {{
          "platform": "YouTube/Coursera",
          "title": "Resource title",
          "link": "Resource URL",
          "description": "Why it helps"
        }}
      ]
    }}
    """
    out_completion = groq_client.chat.completions.create(
        messages=[{"role": "user", "content": out_prompt}],
        model="llama-3.3-70b-versatile",
        response_format={"type": "json_object"}
    )
    outreach_data = json.loads(out_completion.choices[0].message.content)
    
    # Step 5: Aggregate results
    final_output = {
        "company": company_name or "Extracted Company",
        "role": role_name or "Extracted Role",
        "signalScore": {
            "fitScore": ats_score,
            "effort": "Medium" if ats_score > 60 else "High",
            "flag": "Green" if ats_score >= 70 else ("Yellow" if ats_score >= 40 else "Red"),
            "flagReason": f"ATS Score derived from {len(ats_factors)} deterministic factors."
        },
        "gaps": gaps_data.get("gaps", []),
        "tailoredBullets": improvements_data.get("tailoredBullets", []),
        "outreachMessages": outreach_data.get("outreachMessages", {}),
        "learningResources": outreach_data.get("learningResources", [])
    }
    return final_output


# ==========================================
# AUTHENTIC LEMMA SDK ORCHESTRATION 
# ==========================================

async def run_mentor_workflow(profile: dict, resume_text: str, chat_history: list, message: str, groq_client, gemini_client) -> str:
    print("🔥 run_mentor_workflow() CALLED")
    """
    Orchestrates the AI Career Mentor. Uses authentic Lemma SDK if available,
    otherwise falls back to local Groq execution.
    """
    if has_lemma:
        try:
            from lemma_sdk.errors import LemmaAPIError
        except ImportError:
            LemmaAPIError = Exception
            
        def _execute_lemma():
            print("🚀 USING LEMMA SDK")
            print("=" * 60)
            print("LEMMA_TOKEN =", os.getenv("LEMMA_TOKEN"))
            print("=" * 60)
            pod = Pod.from_env()
            print("[lemma_orchestrator] Delegating to genuine Lemma Agent: careermentor")
            
            # Send message to the agent hosted on Lemma
            # We pass profile, resume, and chat_history as metadata so the remote agent has context
            metadata = {
                "profile": profile,
                "resume_summary": resume_text[:1000] if resume_text else "",
                "chat_history": chat_history
            }
            
            # Actual integration of lemma_sdk.agents.run
            # conversation = pod.agents.run(
            #     "CareerMentor", 
            #     message=message,
            #     metadata=metadata
            # )
            context = f"""
            ## USER PROFILE

            Target Role:
            {profile.get("targetRole", "Not specified")}

            Skills:
            {profile.get("skills", "Not specified")}

            Education:
            {profile.get("education", "Not specified")}

            Resume:
            {resume_text[:2500] if resume_text else "No resume uploaded"}

            Conversation History:
            {json.dumps(chat_history, indent=2)}

            ## USER QUESTION

            {message}
            """

            conversation = pod.agents.run(
                "careermentor",
                message=context
            )
            print("=" * 60)
            print("LEMMA AGENT CALLED")
            print("Conversation ID:", conversation.id)
            # Wait for Lemma to finish generating
            time.sleep(2)

            messages = pod.conversations.messages(str(conversation.id))

            print("=" * 60)
            print("LEMMA AGENT CALLED")
            print("Conversation ID:", conversation.id)
            print("=" * 60)

            final_answer = None

            for msg in reversed(messages.items):
                if (
                    msg.role == "assistant"
                    and msg.kind.value == "TEXT"
                ):
                    final_answer = msg.text
                    break

            print("FINAL ANSWER:")
            print(final_answer)
            print("=" * 60)

            if final_answer:
                return final_answer

            raise Exception("Lemma returned no assistant response.")
            
        try:
            return _execute_lemma()
        except LemmaAPIError as e:
            if getattr(e, "status_code", None) == 401 or "401" in str(e):
                print("[lemma_orchestrator] Caught 401 Unauthorized. Attempting token refresh...")
                try:
                    refresh_lemma_token()
                    return _execute_lemma()
                except Exception as refresh_err:
                    print(f"[lemma_orchestrator] Token refresh failed: {refresh_err}")
            
            print("=" * 60)
            print("LEMMA FAILED!")
            print(e)
            print("=" * 60)
            return await local_mentor_workflow(profile, resume_text, chat_history, message, groq_client)
        except Exception as e:
            print("=" * 60)
            print("LEMMA FAILED!")
            print(e)
            print("=" * 60)
            return await local_mentor_workflow(profile, resume_text, chat_history, message, groq_client)


    # Fallback to direct local execution
    return await local_mentor_workflow(profile, resume_text, chat_history, message, groq_client)


async def run_resume_analysis_workflow(jd_text: str, resume_text: str, company_name: str, role_name: str, groq_client) -> Dict[str, Any]:
    """
    Orchestrates the Resume Analysis Pipeline. Uses authentic Lemma SDK if available,
    otherwise falls back to local Groq execution.
    """
    if has_lemma:
        try:
            from lemma_sdk.errors import LemmaAPIError
        except ImportError:
            LemmaAPIError = Exception
            
        def _execute_lemma():
            print("=" * 60)
            print("LEMMA_TOKEN =", os.getenv("LEMMA_TOKEN"))
            print("=" * 60)
            pod = Pod.from_env()
            print("[lemma_orchestrator] Delegating to genuine Lemma Workflow: ResumeAnalysis")
            
            # Actual integration of lemma_sdk.workflows.run
            run_response = pod.workflows.run("ResumeAnalysis")
            
            # Submit the form with the resume and JD inputs if the workflow expects form inputs
            if run_response.active_wait and run_response.active_wait.node_id:
                inputs = {
                    "jd_text": jd_text,
                    "resume_text": resume_text,
                    "company_name": company_name,
                    "role_name": role_name
                }
                final_response = pod.workflows.submit_form(
                    str(run_response.id), 
                    node_id=run_response.active_wait.node_id, 
                    inputs=inputs
                )
                
                # Retrieve the final workflow context output
                if final_response.execution_context:
                    return final_response.execution_context.to_dict()
            return None
                    
        try:
            result = _execute_lemma()
            if result:
                return result
        except LemmaAPIError as e:
            if getattr(e, "status_code", None) == 401 or "401" in str(e):
                print("[lemma_orchestrator] Caught 401 Unauthorized. Attempting token refresh...")
                try:
                    refresh_lemma_token()
                    result = _execute_lemma()
                    if result:
                        return result
                except Exception as refresh_err:
                    print(f"[lemma_orchestrator] Token refresh failed: {refresh_err}")
                    
            print(f"[lemma_orchestrator] Authentic Lemma SDK execution failed: {e}")
            print("[lemma_orchestrator] Falling back to local Groq engine.")
        except Exception as e:
            print(f"[lemma_orchestrator] Authentic Lemma SDK execution failed: {e}")
            print("[lemma_orchestrator] Falling back to local Groq engine.")

    # Fallback to direct local execution
    return await local_resume_workflow(jd_text, resume_text, company_name, role_name, groq_client)
