import os
import sys
import re

file_path = "c:/Users/Vedansh/Desktop/CarrerOS-main/backend/src/services/coding_mentor_service.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the top imports and get_gemini_client
header_add = """import os
import json
from groq import Groq
import google.generativeai as genai

def get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        return Groq(api_key=api_key)
    except Exception:
        return None

def get_gemini_client():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        return None
    genai.configure(api_key=api_key)
    return genai

def clean_json_string(text):
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()

def call_llm(prompt, is_json=True, fallback_mock=None):
    groq_client = get_groq_client()
    if groq_client:
        try:
            kwargs = {
                "messages": [{"role": "user", "content": prompt}],
                "model": "llama-3.3-70b-versatile"
            }
            if is_json:
                kwargs["response_format"] = {"type": "json_object"}
            completion = groq_client.chat.completions.create(**kwargs)
            text = completion.choices[0].message.content
            return json.loads(text) if is_json else text
        except Exception as e:
            print(f"[coding_mentor] Groq failed: {e}")
            
    gen_ai = get_gemini_client()
    if gen_ai:
        try:
            model = gen_ai.GenerativeModel('gemini-1.5-flash')
            result = model.generate_content(prompt)
            if is_json:
                return json.loads(clean_json_string(result.text))
            return result.text
        except Exception as e:
            print(f"[coding_mentor] Gemini failed: {e}")
            
    return fallback_mock
"""

# Regex to replace from start of file up to end of clean_json_string
content = re.sub(
    r"import os[\s\S]*?def clean_json_string\(text\):[\s\S]*?return text\.strip\(\)",
    header_add.strip(),
    content,
    count=1
)

# Remove `gen_ai = get_gemini_client()` and `if not gen_ai: raise ValueError(...)`
content = re.sub(r'    gen_ai = get_gemini_client\(\)\n    if not gen_ai:\n        raise ValueError\("GOOGLE_API_KEY is not set"\)\n', '', content)

# 1. generate_coding_hint
content = re.sub(
    r"    model = gen_ai\.GenerativeModel\('gemini-1\.5-flash'\)\n    try:\n        result = model\.generate_content\(prompt\)\n        parsed = json\.loads\(clean_json_string\(result\.text\)\)\n        return parsed\n    except Exception as e:\n        print\(f\"\[coding_mentor\] API Error in generate_coding_hint: \{e\}\"\)\n        return \{\"hint\": \"Mock hint: Check if you are using the right data structure\. \(API Error - check your keys\)\", \"encouragement\": \"Keep going! You're making progress\.\"\}",
    '    fallback = {"hint": "Mock hint: Check if you are using the right data structure. (API Error - check your keys)", "encouragement": "Keep going! You\'re making progress."}\n    return call_llm(prompt, is_json=True, fallback_mock=fallback)',
    content
)

# 2. review_code_live
content = re.sub(
    r"    model = gen_ai\.GenerativeModel\('gemini-1\.5-flash'\)\n    try:\n        result = model\.generate_content\(prompt\)\n        return json\.loads\(clean_json_string\(result\.text\)\)\n    except Exception as e:\n        print\(f\"\[coding_mentor\] API Error in review_code_live: \{e\}\"\)\n        return \{\"overallScore\": 50, \"summary\": \"Mock review: API Error prevented real review\.\", \"issues\": \[\{\"category\": \"API\", \"severity\": \"warning\", \"line\": \"N/A\", \"description\": \"API Key Invalid\", \"why\": \"The LLM request failed\.\", \"suggestion\": \"Fix your API key\"\}\], \"strengths\": \[\"You wrote some code!\"\], \"timeComplexity\": \"O\(N\)\", \"spaceComplexity\": \"O\(1\)\"\}",
    '    fallback = {"overallScore": 50, "summary": "Mock review: API Error prevented real review.", "issues": [{"category": "API", "severity": "warning", "line": "N/A", "description": "API Key Invalid", "why": "The LLM request failed.", "suggestion": "Fix your API key"}], "strengths": ["You wrote some code!"], "timeComplexity": "O(N)", "spaceComplexity": "O(1)"}\n    return call_llm(prompt, is_json=True, fallback_mock=fallback)',
    content
)

# 3. debug_code
content = re.sub(
    r"    model = gen_ai\.GenerativeModel\('gemini-1\.5-flash'\)\n    try:\n        result = model\.generate_content\(prompt\)\n        return json\.loads\(clean_json_string\(result\.text\)\)\n    except Exception as e:\n        print\(f\"\[coding_mentor\] API Error in debug_code: \{e\}\"\)\n        return \{\"errorExplanation\": \"API Error prevented actual debugging\.\", \"rootCause\": \"Invalid API Key\", \"lineHint\": \"N/A\", \"fix\": \"Check your \.env file\", \"prevention\": \"Ensure quota and valid key\", \"concept\": \"API Authentication\"\}",
    '    fallback = {"errorExplanation": "API Error prevented actual debugging.", "rootCause": "Invalid API Key", "lineHint": "N/A", "fix": "Check your .env file", "prevention": "Ensure quota and valid key", "concept": "API Authentication"}\n    return call_llm(prompt, is_json=True, fallback_mock=fallback)',
    content
)

# 4. analyze_complexity
content = re.sub(
    r"    model = gen_ai\.GenerativeModel\('gemini-1\.5-flash'\)\n    try:\n        result = model\.generate_content\(prompt\)\n        return json\.loads\(clean_json_string\(result\.text\)\)\n    except Exception as e:\n        print\(f\"\[coding_mentor\] API Error in analyze_complexity: \{e\}\"\)\n        return \{\"timeComplexity\": \{\"best\": \"O\(1\)\", \"average\": \"O\(N\)\", \"worst\": \"O\(N\^2\)\", \"explanation\": \"Mock explanation due to API error\"\}, \"spaceComplexity\": \{\"total\": \"O\(1\)\", \"auxiliary\": \"O\(1\)\", \"explanation\": \"Mock space complexity\"\}, \"optimizations\": \[\], \"alternativeAlgorithms\": \[\]\}",
    '    fallback = {"timeComplexity": {"best": "O(1)", "average": "O(N)", "worst": "O(N^2)", "explanation": "Mock explanation due to API error"}, "spaceComplexity": {"total": "O(1)", "auxiliary": "O(1)", "explanation": "Mock space complexity"}, "optimizations": [], "alternativeAlgorithms": []}\n    return call_llm(prompt, is_json=True, fallback_mock=fallback)',
    content
)

# 5. simulate_execution
content = re.sub(
    r"    model = gen_ai\.GenerativeModel\('gemini-1\.5-flash'\)\n    try:\n        result = model\.generate_content\(prompt\)\n        return json\.loads\(clean_json_string\(result\.text\)\)\n    except Exception as e:\n        print\(f\"\[coding_mentor\] API Error in simulate_execution: \{e\}\"\)\n        return \{\"compiles\": False, \"compileError\": \"Mock compilation error: LLM API request failed\. Please check your API keys\.\", \"results\": \[\{\"input\": \"mock input\", \"expected\": \"mock\", \"actual\": \"error\", \"passed\": False, \"error\": \"API Error\"\}\], \"summary\": \"0/1 test cases passed\"\}",
    '    fallback = {"compiles": False, "compileError": "Mock compilation error: LLM API request failed. Please check your API keys.", "results": [{"input": "mock input", "expected": "mock", "actual": "error", "passed": False, "error": "API Error"}], "summary": "0/1 test cases passed"}\n    return call_llm(prompt, is_json=True, fallback_mock=fallback)',
    content
)

# 6. generate_reflection
content = re.sub(
    r"    model = gen_ai\.GenerativeModel\('gemini-1\.5-flash'\)\n    try:\n        result = model\.generate_content\(prompt\)\n        return json\.loads\(clean_json_string\(result\.text\)\)\n    except Exception as e:\n        print\(f\"\[coding_mentor\] API Error in generate_reflection: \{e\}\"\)\n        return \{\"didWell\": \[\"Attempted the problem\"\], \"mistakes\": \[\"Encountered an API error\"\], \"interviewerPerspective\": \"The candidate's API key seems invalid\.\", \"topCandidateSolution\": \"A top candidate would have valid API keys\.\", \"conceptsToRevise\": \[\"API Authentication\"\], \"recommendedProblems\": \[\], \"overallGrade\": \"N/A\", \"encouragement\": \"Keep practicing!\"\}",
    '    fallback = {"didWell": ["Attempted the problem"], "mistakes": ["Encountered an API error"], "interviewerPerspective": "The candidate\'s API key seems invalid.", "topCandidateSolution": "A top candidate would have valid API keys.", "conceptsToRevise": ["API Authentication"], "recommendedProblems": [], "overallGrade": "N/A", "encouragement": "Keep practicing!"}\n    return call_llm(prompt, is_json=True, fallback_mock=fallback)',
    content
)

# 7. mentor_chat
content = re.sub(
    r"    model = gen_ai\.GenerativeModel\('gemini-1\.5-flash'\)\n    try:\n        result = model\.generate_content\(prompt\)\n        return result\.text\n    except Exception as e:\n        print\(f\"\[coding_mentor\] API Error in mentor_chat: \{e\}\"\)\n        return \"I'm having trouble connecting to my AI brain\. Please check that your GOOGLE_API_KEY is correct and active\.\"",
    '    fallback = "I\'m having trouble connecting to my AI brain. Please check your API keys."\n    return call_llm(prompt, is_json=False, fallback_mock=fallback)',
    content
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patching complete!")
