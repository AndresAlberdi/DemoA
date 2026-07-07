import os
from google import genai
from google.genai import types

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "demoa-c585c")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

print(f"Testing Google GenAI SDK for Project: {PROJECT_ID}, Location: {LOCATION}")

try:
    client = genai.Client(vertexai=True, project=PROJECT_ID, location=LOCATION)
    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents='Hola, responde con la palabra "Exito"'
    )
    print("Response:", response.text)
except Exception as e:
    print("Error:", e)
