import firebase_admin
from firebase_admin import credentials, auth
import requests

cred = credentials.Certificate("config/firebase-adminsdk.json")
firebase_admin.initialize_app(cred)

# Fix admin name
print("Updating admin name...")
try:
    user = auth.get_user_by_email('Alberdi.andres@gmail.com')
    auth.update_user(user.uid, display_name='Andres Alberdi')
    print("Success: Updated name for Alberdi.andres@gmail.com")
except Exception as e:
    print("Error updating user:", e)

# List all users
for user in auth.list_users().iterate_all():
    print(f"User: {user.email} - {user.display_name}")

# Test Vertex AI (dummy request)
print("\nTesting Vertex AI API on Cloud Run...")
res = requests.post(
    "https://demoa-backend-668678630709.us-central1.run.app/api/verify-docs",
    json={"ci_estudiante": "12345", "archivo_b64": "dummy"}
)
print("Vertex API Response Status:", res.status_code)
try:
    print(res.json())
except:
    print(res.text)
