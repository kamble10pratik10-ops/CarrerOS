import os
import json
import time
from typing import Dict, Any
from pathlib import Path
import requests

try:
    from lemma_sdk import Pod
    from lemma_sdk.errors import LemmaAPIError
    has_lemma = True
except ImportError:
    has_lemma = False
    LemmaAPIError = Exception

from src.providers.errors import (
    LemmaAuthenticationError,
    LemmaWorkflowError,
    LemmaNetworkError,
    LemmaTimeoutError,
    LemmaJSONValidationError
)

def refresh_lemma_token():
    """Refreshes the Lemma CLI/SDK token and updates environment variables and local config."""
    print("[LemmaProvider] Token expired or not set! Attempting to refresh...")
    refresh_token = os.getenv("LEMMA_REFRESH_TOKEN")
    
    # If not in env, try to load from CLI config
    if not refresh_token:
        try:
            config_path = Path.home() / ".lemma" / "config.json"
            if config_path.exists():
                with open(config_path, "r") as f:
                    config = json.load(f)
                    active_server = config.get("active_server", "cloud")
                    server_config = config.get("servers", {}).get(active_server, {})
                    refresh_token = server_config.get("refresh_token")
        except Exception as e:
            print(f"[LemmaProvider] Failed to read CLI config for refresh token: {e}")

    if not refresh_token:
        raise LemmaAuthenticationError("No LEMMA_REFRESH_TOKEN found in environment or local CLI config.")

    base_url = os.getenv("LEMMA_BASE_URL", "https://api.lemma.work")
    try:
        response = requests.post(
            f"{base_url.rstrip('/')}/auth/cli/refresh",
            json={"refresh_token": refresh_token},
            headers={"Accept": "application/json"},
            timeout=10
        )
    except requests.RequestException as e:
        raise LemmaNetworkError(f"Network error during token refresh: {e}")
    
    if response.status_code >= 400:
        raise LemmaAuthenticationError(f"Failed to refresh token: HTTP {response.status_code} - {response.text}")
        
    data = response.json()
    new_token = data.get("access_token") or data.get("token")
    new_refresh = data.get("refresh_token")
    
    if new_token:
        os.environ["LEMMA_TOKEN"] = new_token
    if new_refresh:
        os.environ["LEMMA_REFRESH_TOKEN"] = new_refresh
        
    # Persist back to local CLI config if it exists
    try:
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

    print("[LemmaProvider] Successfully refreshed Lemma token!")


def _do_analyze_resume(jd_text: str, resume_text: str, company_name: str, role_name: str) -> Dict[str, Any]:
    """Internal execution logic mapping errors"""
    if not has_lemma:
        raise LemmaWorkflowError("Lemma SDK is not installed or requires Python >= 3.11.")

    try:
        pod = Pod.from_env()
    except Exception as e:
        raise LemmaAuthenticationError(f"Failed to initialize Pod from env: {e}")

    # Start the workflow
    try:
        run_response = pod.workflows.run("resumeanalysis")
    except LemmaAPIError as e:
        if getattr(e, "status_code", None) == 401 or "401" in str(e):
            raise LemmaAuthenticationError(str(e))
        if getattr(e, "status_code", None) == 504 or "504" in str(e):
            raise LemmaTimeoutError(str(e))
        raise LemmaWorkflowError(f"Failed to run workflow: {e}")
    except requests.RequestException as e:
        raise LemmaNetworkError(f"Network error starting workflow: {e}")
    except Exception as e:
        raise LemmaWorkflowError(f"Unexpected error starting workflow: {e}")

    # Submit form inputs
    if run_response.active_wait and run_response.active_wait.node_id:
        inputs = {
            "jd_text": jd_text,
            "resume_text": resume_text,
            "company_name": company_name,
            "role_name": role_name
        }
        try:
            final_response = pod.workflows.submit_form(
                str(run_response.id), 
                node_id=run_response.active_wait.node_id, 
                inputs=inputs
            )
            if final_response.execution_context:
                result = final_response.execution_context.to_dict()
                return result
            else:
                raise LemmaJSONValidationError("Workflow returned no execution context.")
        except LemmaAPIError as e:
            if getattr(e, "status_code", None) == 401 or "401" in str(e):
                raise LemmaAuthenticationError(str(e))
            if getattr(e, "status_code", None) == 504 or "504" in str(e):
                raise LemmaTimeoutError(str(e))
            raise LemmaWorkflowError(f"Failed to submit workflow form: {e}")
        except requests.RequestException as e:
            raise LemmaNetworkError(f"Network error submitting workflow form: {e}")
        except Exception as e:
            raise LemmaWorkflowError(f"Unexpected error submitting form: {e}")
            
    raise LemmaWorkflowError("Workflow did not pause for form input.")


def analyze_resume(jd_text: str, resume_text: str, company_name: str, role_name: str) -> Dict[str, Any]:
    """
    Executes the ResumeAnalysis workflow on Lemma.
    Automatically handles token refreshes.
    Returns the parsed JSON context.
    """
    try:
        return _do_analyze_resume(jd_text, resume_text, company_name, role_name)
    except LemmaAuthenticationError:
        refresh_lemma_token()
        return _do_analyze_resume(jd_text, resume_text, company_name, role_name)
