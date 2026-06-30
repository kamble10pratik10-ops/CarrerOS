import os
import json
from dotenv import load_dotenv

load_dotenv(override=True)

print("Testing Groq...")
try:
    from groq import Groq
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if groq_api_key:
        client = Groq(api_key=groq_api_key)
        completion = client.chat.completions.create(
            messages=[{"role": "user", "content": "Say hello"}],
            model="llama-3.3-70b-versatile"
        )
        print("Groq works! Response:", completion.choices[0].message.content)
    else:
        print("GROQ_API_KEY not found in env.")
except Exception as e:
    print("Groq failed:", e)

print("\nTesting Gemini...")
try:
    import google.generativeai as genai
    google_api_key = os.environ.get("GOOGLE_API_KEY")
    if google_api_key:
        genai.configure(api_key=google_api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        result = model.generate_content("Say hello")
        print("Gemini works! Response:", result.text)
    else:
        print("GOOGLE_API_KEY not found in env.")
except Exception as e:
    print("Gemini failed:", e)
