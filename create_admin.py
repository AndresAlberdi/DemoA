import os
import firebase_admin
from firebase_admin import credentials, auth
from dotenv import load_dotenv

load_dotenv()
cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "./config/firebase-adminsdk.json")

# Initialize Firebase Admin
try:
    firebase_admin.get_app()
except ValueError:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

email = "alberdi.andres@gmail.com"
password = "AdminPassword123!"

try:
    user = auth.create_user(
        email=email,
        password=password,
        display_name="Andres Alberdi (Admin)"
    )
    print(f"✅ Usuario administrador creado exitosamente!")
    print(f"Email: {email}")
    print(f"Password: {password}")
except Exception as e:
    if "email-already-exists" in str(e):
        print(f"El usuario {email} ya existe en Firebase Auth.")
    else:
        print(f"Error creando usuario: {e}")
