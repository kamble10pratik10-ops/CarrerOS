import os
import json
import time
import requests
import random
from typing import List, Dict, Any
from src.lib.supabase_client import get_supabase_client

LOCAL_CACHE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "local_data", "codelab_questions.json")
os.makedirs(os.path.dirname(LOCAL_CACHE_PATH), exist_ok=True)

# Initial seed of problems in case API fails and DB is empty
SEED_PROBLEMS = [
    {
        "id": "two-sum",
        "title": "Two Sum",
        "difficulty": "Easy",
        "topic": "Arrays",
        "description": "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
        "examples": [{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]"}],
        "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
        "testCases": [{"input": "nums = [2,7,11,15], target = 9", "expected": "[0,1]"}],
        "starterCode": {
            "python": "def twoSum(nums, target):\n    # Your code here\n    pass",
            "javascript": "function twoSum(nums, target) {\n    // Your code here\n}",
            "java": "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[]{};\n    }\n}",
            "cpp": "class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        return {};\n    }\n};"
        },
        "tags": ["Array", "Hash Map"]
    },
    {
        "id": "longest-substring",
        "title": "Longest Substring Without Repeating",
        "difficulty": "Medium",
        "topic": "Strings",
        "description": "Given a string `s`, find the length of the longest substring without repeating characters.",
        "examples": [{"input": "s = \"abcabcbb\"", "output": "3"}],
        "constraints": ["0 <= s.length <= 5 * 10^4"],
        "testCases": [{"input": "s = \"abcabcbb\"", "expected": "3"}],
        "starterCode": {
            "python": "def lengthOfLongestSubstring(s):\n    pass",
            "javascript": "function lengthOfLongestSubstring(s) {}",
            "java": "class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        return 0;\n    }\n}",
            "cpp": "class Solution {\npublic:\n    int lengthOfLongestSubstring(string s) {\n        return 0;\n    }\n};"
        },
        "tags": ["Sliding Window"]
    }
]

def _read_local_cache() -> List[Dict[str, Any]]:
    if os.path.exists(LOCAL_CACHE_PATH):
        try:
            with open(LOCAL_CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return SEED_PROBLEMS

def _write_local_cache(questions: List[Dict[str, Any]]):
    try:
        with open(LOCAL_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(questions, f, indent=2)
    except Exception as e:
        print(f"[LeetcodeService] Error writing local cache: {e}")


class LeetcodeService:
    def __init__(self):
        self.api_base = "https://alfa-leetcode-api.onrender.com"
        
    def _fetch_from_supabase(self, difficulty: str = "All", topic: str = "All", limit: int = 10) -> List[Dict[str, Any]]:
        client = get_supabase_client()
        if not client:
            return []
            
        try:
            query = client.table("codelab_questions").select("*")
            if difficulty and difficulty != "All":
                query = query.eq("difficulty", difficulty)
            if topic and topic != "All":
                query = query.eq("topic", topic)
                
            res = query.limit(limit).execute()
            return res.data or []
        except Exception as e:
            print(f"[LeetcodeService] Supabase fetch failed: {e}")
            return []

    def _save_to_supabase(self, question: Dict[str, Any]):
        client = get_supabase_client()
        if not client:
            return
            
        try:
            # We map JS camelCase keys to snake_case for Supabase
            db_row = {
                "id": question["id"],
                "title": question["title"],
                "difficulty": question["difficulty"],
                "topic": question.get("topic", ""),
                "description": question["description"],
                "examples": question.get("examples", []),
                "constraints": question.get("constraints", []),
                "test_cases": question.get("testCases", []),
                "starter_code": question.get("starterCode", {}),
                "tags": question.get("tags", [])
            }
            client.table("codelab_questions").upsert(db_row).execute()
        except Exception as e:
            print(f"[LeetcodeService] Supabase upsert failed: {e}")

    def _fetch_from_api(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Fetches a random set of problems from ALFA Leetcode API"""
        print("[LeetcodeService] Hitting ALFA API for new questions...")
        try:
            # We request more than needed because some might be paid only
            res = requests.get(f"{self.api_base}/problems?limit={limit*2}", timeout=8)
            if res.status_code != 200:
                return []
            
            data = res.json()
            problems = data.get("problemsetQuestionList", [])
            
            # Filter free problems
            free_problems = [p for p in problems if not p.get("isPaidOnly")]
            # Shuffle to get random ones
            random.shuffle(free_problems)
            
            detailed_questions = []
            for p in free_problems[:limit]:
                # Fetch details for each
                slug = p["titleSlug"]
                try:
                    detail_res = requests.get(f"{self.api_base}/select?titleSlug={slug}", timeout=5)
                    if detail_res.status_code == 200:
                        detail_data = detail_res.json()
                        formatted = self._format_alfa_response(detail_data)
                        if formatted:
                            detailed_questions.append(formatted)
                except Exception as de:
                    print(f"[LeetcodeService] Failed to fetch details for {slug}: {de}")
                    
            return detailed_questions
        except Exception as e:
            print(f"[LeetcodeService] ALFA API Error: {e}")
            return []
            
    def _format_alfa_response(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Converts ALFA response to our frontend format"""
        try:
            return {
                "id": data["titleSlug"],
                "title": data["questionTitle"],
                "difficulty": data["difficulty"],
                "topic": data.get("topicTags", [{"name": "General"}])[0]["name"],
                "description": data.get("question", "No description available."),
                "examples": [{"input": "See description", "output": "See description"}],
                "constraints": [],
                "testCases": [{"input": "Custom Input", "expected": "Custom Output"}],
                "starterCode": {
                    "python": "class Solution:\n    pass",
                    "javascript": "var Solution = function() {};",
                    "java": "class Solution {\n}",
                    "cpp": "class Solution {\n};"
                },
                "tags": [t["name"] for t in data.get("topicTags", [])]
            }
        except Exception:
            return None

    def get_questions(self, difficulty: str = "All", topic: str = "All", limit: int = 10) -> List[Dict[str, Any]]:
        print(f"[LeetcodeService] Requesting {limit} questions (Diff: {difficulty}, Topic: {topic})")
        
        # 1. Try Supabase
        db_questions = self._fetch_from_supabase(difficulty, topic, limit)
        
        # We need to map Supabase snake_case back to camelCase for frontend
        mapped_db_questions = []
        for q in db_questions:
            mapped_db_questions.append({
                "id": q["id"],
                "title": q["title"],
                "difficulty": q["difficulty"],
                "topic": q["topic"],
                "description": q["description"],
                "examples": q.get("examples", []),
                "constraints": q.get("constraints", []),
                "testCases": q.get("test_cases", []),
                "starterCode": q.get("starter_code", {}),
                "tags": q.get("tags", [])
            })
            
        if len(mapped_db_questions) >= limit:
            print("[LeetcodeService] Served fully from Supabase.")
            return mapped_db_questions
            
        # 2. If Supabase is empty or disabled, try Local Cache
        local_cache = _read_local_cache()
        filtered_local = []
        for q in local_cache:
            if (difficulty == "All" or q.get("difficulty") == difficulty) and \
               (topic == "All" or q.get("topic") == topic):
                filtered_local.append(q)
                
        # Merge DB and Local without duplicates
        existing_ids = {q["id"] for q in mapped_db_questions}
        for q in filtered_local:
            if q["id"] not in existing_ids:
                mapped_db_questions.append(q)
                existing_ids.add(q["id"])
                
        if len(mapped_db_questions) >= limit:
            print("[LeetcodeService] Served from Cache/Supabase.")
            return mapped_db_questions[:limit]
            
        # 3. Not enough questions, fetch from API
        needed = limit - len(mapped_db_questions)
        new_questions = self._fetch_from_api(limit=needed)
        
        # 4. Save new questions to Supabase and Local Cache
        if new_questions:
            for nq in new_questions:
                self._save_to_supabase(nq)
                if nq["id"] not in existing_ids:
                    local_cache.append(nq)
                    mapped_db_questions.append(nq)
                    
            _write_local_cache(local_cache)
            
        print(f"[LeetcodeService] Returning {len(mapped_db_questions)} questions.")
        return mapped_db_questions[:limit]

# Singleton instance
leetcode_service = LeetcodeService()
