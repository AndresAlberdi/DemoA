import os
from google import genai
from google.genai import types

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "demoa-c585c")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

models_to_test = [
    'gemini-1.5-flash-001',
    'gemini-1.5-flash',
    'gemini-3.5-flash-001',
    'gemini-3.5-flash',
    'gemini-pro',
    'gemini-1.0-pro-001',
    'gemini-1.0-pro-vision-001'
]

for m in models_to_test:
    print(f"Testing {m}...")
    try:
        response = client.models.generate_content(
            model=m,
            contents='Hola'
        )
        print(f"SUCCESS with {m}: {response.text}")
    except Exception as e:
        print(f"FAILED with {m}")
