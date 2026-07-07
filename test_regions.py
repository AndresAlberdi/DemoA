import os
from google import genai

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "demoa-c585c")
regions = ["us-central1", "us-east4", "us-west1", "us-west4", "europe-west4", "europe-west1", "asia-southeast1"]
models = ["gemini-3.5-flash", "gemini-1.5-flash"]

for loc in regions:
    client = genai.Client(vertexai=True, project=PROJECT_ID, location=loc)
    for m in models:
        try:
            response = client.models.generate_content(
                model=m,
                contents='Hola'
            )
            print(f"SUCCESS with {m} in {loc}: {response.text}")
            exit(0)
        except Exception as e:
            # print(f"FAILED {m} in {loc}")
            pass

print("ALL FAILED")
