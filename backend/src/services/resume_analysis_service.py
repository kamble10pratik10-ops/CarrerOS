import os
import time
import traceback
from typing import Dict, Any

from src.providers.lemma_provider import analyze_resume as lemma_analyze_resume
from src.providers.groq_provider import analyze_resume as groq_analyze_resume
from src.providers.errors import LemmaBaseError, LemmaJSONValidationError

REQUIRED_KEYS = {
    "company",
    "role",
    "signalScore",
    "gaps",
    "tailoredBullets",
    "outreachMessages",
    "learningResources"
}

def validate_resume_json(result: Dict[str, Any]) -> None:
    """Validates the output of the resume analysis."""
    if not isinstance(result, dict):
        raise LemmaJSONValidationError("Result is not a JSON object.")
        
    missing_keys = REQUIRED_KEYS - set(result.keys())
    if missing_keys:
        raise LemmaJSONValidationError(f"Missing required fields: {', '.join(missing_keys)}")
        
    if not isinstance(result.get("signalScore"), dict):
        raise LemmaJSONValidationError("Field 'signalScore' must be an object.")

def _log_lemma_success(duration: float, result: Dict[str, Any]):
    debug = os.environ.get("LEMMA_DEBUG", "").lower() == "true"
    
    print("\n" + "=" * 40)
    print("[ResumeAnalysis]")
    print(f"Primary Provider: Lemma")
    print(f"Workflow: resumeanalysis")
    print(f"Status: SUCCESS")
    print(f"Duration: {duration:.2f}s")
    print(f"Fallback Used: false")
    
    if debug:
        print("\n--- Debug Info ---")
        print("Parsed JSON keys:", list(result.keys()))
    print("=" * 40 + "\n")


def _log_lemma_failure(e: Exception, duration: float):
    debug = os.environ.get("LEMMA_DEBUG", "").lower() == "true"
    
    print("\n" + "=" * 40)
    print("[ResumeAnalysis]")
    print("Lemma Failed")
    print(f"Reason: {type(e).__name__} - {str(e)}")
    print(f"Duration: {duration:.2f}s")
    
    if debug:
        print("\n--- Exception Stack Trace ---")
        traceback.print_exc()
        
    print("Switching to Groq...")
    print("=" * 40 + "\n")


async def run_resume_analysis(
    jd_text: str, 
    resume_text: str, 
    company_name: str, 
    role_name: str, 
    groq_client
) -> Dict[str, Any]:
    """
    Orchestrates the Resume Analysis Pipeline. 
    Lemma is the primary execution path, with a seamless fallback to Groq.
    """
    start_time = time.time()
    
    try:
        # 1. Execute Lemma
        result = lemma_analyze_resume(jd_text, resume_text, company_name, role_name)
        
        # 2. Validate JSON structure matches expected schema
        validate_resume_json(result)
        
        # 3. Log success
        duration = time.time() - start_time
        _log_lemma_success(duration, result)
        
        return result
        
    except Exception as e:
        # Any failure (timeout, network, auth, validation, etc.) triggers fallback
        duration = time.time() - start_time
        _log_lemma_failure(e, duration)
        
        # 4. Fallback to Groq
        groq_result = await groq_analyze_resume(
            jd_text=jd_text,
            resume_text=resume_text,
            company_name=company_name,
            role_name=role_name,
            groq_client=groq_client
        )
        
        print("[ResumeAnalysis] Groq Success")
        return groq_result
