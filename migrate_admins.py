import firebase_admin
from firebase_admin import credentials, auth, firestore

cred = credentials.Certificate("config/firebase-adminsdk.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

print("Populating admins collection in Firestore...")
try:
    for user in auth.list_users().iterate_all():
        print(f"Adding {user.email}...")
        db.collection("admins").document(user.uid).set({
            "email": user.email,
            "nombre": user.display_name or "Sin Nombre"
        })
    print("Done.")
except Exception as e:
    print("Error:", e)
