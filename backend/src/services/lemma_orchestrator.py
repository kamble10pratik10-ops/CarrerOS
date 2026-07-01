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

