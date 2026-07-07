import os
import google.generativeai as genai

api_key = os.environ.get("GEMINI_API_KEY")
print("Key length:", len(api_key) if api_key else 0)
genai.configure(api_key=api_key)

models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-1.5-flash-8b']

for m in models:
    print(f"Testing {m} via AI Studio...")
    try:
        model = genai.GenerativeModel(m)
        response = model.generate_content("Hola")
        print(f"SUCCESS with {m}: {response.text}")
    except Exception as e:
        print(f"FAILED with {m}: {e}")
