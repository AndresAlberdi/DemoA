import os
import google.generativeai as genai

api_key = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=api_key)

models = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest']

for m in models:
    print(f"Testing {m} via AI Studio...")
    try:
        model = genai.GenerativeModel(m)
        response = model.generate_content("Hola")
        print(f"SUCCESS with {m}: {response.text}")
    except Exception as e:
        print(f"FAILED with {m}: {e}")
