import os
import json
import base64
from io import BytesIO
import urllib.request

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

import firebase_admin
from firebase_admin import credentials, firestore, storage, auth as admin_auth

from google import genai
from google.genai import types
import csv
import io
import zipfile
from fastapi.responses import StreamingResponse

# Cargar variables de entorno
load_dotenv()

# Inicializar Firebase
STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", f"{os.getenv('GOOGLE_CLOUD_PROJECT', 'demoa-c585c')}.firebasestorage.app")
try:
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "config/firebase-adminsdk.json")
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {'storageBucket': STORAGE_BUCKET})
    else:
        firebase_admin.initialize_app(options={'storageBucket': STORAGE_BUCKET})
    
    db = firestore.client()
    bucket = storage.bucket()
except Exception as e:
    print(f"Advertencia: No se pudo inicializar Firebase. Error: {e}")
    db = None
    bucket = None

# Inicializar Gemini Client para Vertex AI
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT", "demoa-c585c")
try:
    client = genai.Client(vertexai=True, project=PROJECT_ID, location="asia-southeast1")
except Exception as e:
    print(f"Advertencia: No se pudo inicializar Vertex AI. Error: {e}")

app = FastAPI(title="DemoA API", description="Backend puro en GCP para el sistema de admisiones UCB")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción cambiar por el dominio de Firebase Hosting
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos Pydantic
class DocsReviewRequest(BaseModel):
    ci_estudiante: str
    archivo_b64: str

class DiplomaReviewRequest(BaseModel):
    ci_estudiante: str
    archivo_b64: str

class AdminCreateRequest(BaseModel):
    email: str
    password: str
    nombre: str

class AdminPasswordRequest(BaseModel):
    email: str
    new_password: str

class ExamScheduleRequest(BaseModel):
    ci_estudiante: str
    tipo_examen: str

class ContractRequest(BaseModel):
    ci_estudiante: str

@app.get("/")
def read_root():
    return {"status": "ok", "message": "DemoA Backend is running!"}

@app.post("/api/verify-docs")
async def verify_docs(request: DocsReviewRequest):
    """
    Recibe el documento PDF en Base64, lo envía a Vertex AI para análisis
    estricto y actualiza/crea el registro en Firestore.
    """
    if not db:
        raise HTTPException(status_code=500, detail="Firebase no configurado")

    try:
        # 1. Decodificar el PDF desde Base64
        b64_data = request.archivo_b64
        if ',' in b64_data:
            b64_data = b64_data.split(',')[1]
        pdf_bytes = base64.b64decode(b64_data)

        # 2. Configurar el archivo
        document_part = types.Part.from_bytes(data=pdf_bytes, mime_type='application/pdf')

        prompt = """
        Eres un experto validador de documentos de identidad. Analiza este documento PDF.
        Extrae la siguiente información y responde ÚNICAMENTE en formato JSON estricto sin backticks ni markdown:
        {
            "ci_extraido": "Número de carnet de identidad encontrado, incluyendo la extensión alfanumérica si existe (ej. 1234567-1A)",
            "es_boliviano": true/false (si el documento corresponde a una Cédula de Identidad del Estado Plurinacional de Bolivia),
            "tiene_fotografia": true/false (si se detecta el rostro/fotografía de una persona en el documento),
            "nombres_extraidos": "Nombres completos encontrados",
            "anverso_y_reverso_presentes": true/false (si el archivo incluye visiblemente tanto la parte frontal como la trasera del carnet)
        }
        """

        # 3. Llamar a Vertex AI
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=[document_part, prompt]
        )
        
        # 4. Parsear el JSON de Gemini
        raw_text = response.text.replace('```json', '').replace('```', '').strip()
        ia_resultado = json.loads(raw_text)

        # 5. Lógica de validación estricta
        valido = (
            ia_resultado.get("es_boliviano", False) and 
            ia_resultado.get("tiene_fotografia", False) and 
            ia_resultado.get("anverso_y_reverso_presentes", False) and
            ia_resultado.get("ci_extraido") != ""
        )
        
        nuevo_estado = "Habilitado_Conocimientos" if valido else "Rechazado_Documentos"
        
        # 6. Guardar / Actualizar en Firestore (crea si no existe, ideal para el demo)
        doc_ref = db.collection('estudiantes').document(request.ci_estudiante)
        doc_ref.set({
            "ci": request.ci_estudiante,
            "nombres": ia_resultado.get("nombres_extraidos", ""),
            "estado": nuevo_estado,
            "log_ia": ia_resultado
        }, merge=True)

        return {
            "message": "Documentos revisados",
            "estado_nuevo": nuevo_estado,
            "resultado_ia": ia_resultado
        }

    except Exception as e:
        print(f"Error procesando documentos: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/schedule-exam")
async def schedule_exam(request: ExamScheduleRequest):
    if not db:
        raise HTTPException(status_code=500, detail="Firebase no configurado")
        
    static_meet_url = "https://meet.google.com/simulated-meet-url"
    
    doc_ref = db.collection('estudiantes').document(request.ci_estudiante)
    doc_ref.update({
        "meet_url_actual": static_meet_url,
        "estado_examen": f"Programado_{request.tipo_examen}"
    })
    
    return {"message": f"Examen programado", "meet_url": static_meet_url}

@app.post("/api/generate-contract")
async def generate_contract(request: ContractRequest):
    """
    Genera un PDF usando ReportLab con los datos del alumno y lo sube a Storage.
    """
    if not db or not bucket:
        raise HTTPException(status_code=500, detail="Firebase/Storage no configurado")
    
    try:
        # 1. Obtener datos del alumno
        doc_ref = db.collection('estudiantes').document(request.ci_estudiante)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Estudiante no encontrado")
            
        alumno = doc.to_dict()
        nombre_completo = f"{alumno.get('nombres', '')} {alumno.get('apellidos', '')}"
        
        # 2. Generar el PDF en memoria con ReportLab
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, 750, "UNIVERSIDAD CATÓLICA BOLIVIANA 'SAN PABLO'")
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, 730, "CONTRATO DE ADMISIÓN Y REGISTRO ACADÉMICO")
        
        c.setFont("Helvetica", 11)
        c.drawString(50, 690, f"Por el presente documento, se certifica la admisión del estudiante a los programas académicos:")
        
        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, 660, "1. DATOS DEL ESTUDIANTE")
        c.setFont("Helvetica", 11)
        c.drawString(70, 640, f"Nombre Completo: {nombre_completo}")
        c.drawString(70, 620, f"Cédula de Identidad: {request.ci_estudiante}")
        c.drawString(70, 600, f"Correo Electrónico: {alumno.get('email', 'No registrado')}")
        c.drawString(70, 580, f"Celular: {alumno.get('telefono_celular', 'No registrado')}")

        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, 550, "2. DOCUMENTACIÓN ENTREGADA")
        c.setFont("Helvetica", 11)
        c.drawString(70, 530, f"Documento de Identidad (Verificado por IA): {'Entregado' if alumno.get('url_ci') else 'Pendiente'}")
        c.drawString(70, 510, f"Título de Bachiller: {'Eximido' if alumno.get('titulo_requerido') is False else ('Entregado' if alumno.get('url_diploma') else 'Pendiente')}")

        c.setFont("Helvetica-Bold", 11)
        c.drawString(50, 480, "3. ESTADO DE EXÁMENES DE ADMISIÓN")
        c.setFont("Helvetica", 11)
        # Note: If they reached here, they passed both.
        c.drawString(70, 460, "Examen de Conocimientos: APROBADO")
        c.drawString(70, 440, "Examen de Inglés: APROBADO")
        
        c.setFont("Helvetica", 10)
        c.drawString(50, 390, "Declaro que toda la información y documentación presentada es fidedigna y me someto a los")
        c.drawString(50, 375, "reglamentos vigentes de la Universidad Católica Boliviana.")
        
        c.line(100, 250, 250, 250)
        c.drawString(120, 230, "Firma del Estudiante")
        
        c.line(350, 250, 500, 250)
        c.drawString(370, 230, "Firma de Admisiones UCB")
        
        c.save()
        
        buffer.seek(0)
        
        # 3. Subir el PDF a Firebase Storage
        storage_path = f"contratos/{request.ci_estudiante}_contrato.pdf"
        blob = bucket.blob(storage_path)
        blob.upload_from_string(buffer.getvalue(), content_type='application/pdf')
        blob.make_public()
        
        public_url = blob.public_url
        
        # 4. Actualizar Firestore con la URL del contrato
        doc_ref.update({
            "url_contrato_final": public_url,
            "estado": "Contrato_Generado"
        })
        
        return {
            "message": "Contrato generado y subido a Storage exitosamente",
            "contrato_url": public_url
        }
        
    except Exception as e:
        print(f"Error generando contrato: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/verify-diploma")
async def verify_diploma(request: DiplomaReviewRequest):
    if not db:
        raise HTTPException(status_code=500, detail="Firebase no configurado")
    try:
        b64_data = request.archivo_b64
        if ',' in b64_data:
            b64_data = b64_data.split(',')[1]
        pdf_bytes = base64.b64decode(b64_data)
        document_part = types.Part.from_bytes(data=pdf_bytes, mime_type='application/pdf')

        prompt = """
        Eres un experto validador de documentos académicos. Analiza este documento PDF.
        Verifica si se trata de un "Título de Bachiller" válido. 
        Responde ÚNICAMENTE en formato JSON estricto sin backticks ni markdown:
        {
            "es_titulo_bachiller": true/false (si el documento parece ser un Título de Bachiller o equivalente válido para ingreso a la universidad)
        }
        """
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=[document_part, prompt]
        )
        raw_text = response.text.replace('```json', '').replace('```', '').strip()
        ia_resultado = json.loads(raw_text)

        valido = ia_resultado.get("es_titulo_bachiller", False)
        nuevo_estado = "Habilitado_Conocimientos" if valido else "Rechazado_Titulo"
        
        doc_ref = db.collection('estudiantes').document(request.ci_estudiante)
        doc_ref.set({
            "estado": nuevo_estado,
            "log_ia_titulo": ia_resultado
        }, merge=True)

        return {
            "message": "Título revisado",
            "estado_nuevo": nuevo_estado,
            "resultado_ia": ia_resultado
        }
    except Exception as e:
        print(f"Error procesando título: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete-student/{ci}")
async def delete_student(ci: str):
    if not db or not bucket:
        raise HTTPException(status_code=500, detail="Firebase no configurado")
    try:
        # Borrar de firestore
        db.collection('estudiantes').document(ci).delete()
        
        # Borrar archivos en storage (prefijo con el CI)
        blobs = bucket.list_blobs(prefix=f"documentos_identidad/{ci}_")
        for blob in blobs:
            blob.delete()
        blobs_tit = bucket.list_blobs(prefix=f"titulos_bachiller/{ci}_")
        for blob in blobs_tit:
            blob.delete()
        blobs_cont = bucket.list_blobs(prefix=f"contratos/{ci}_")
        for blob in blobs_cont:
            blob.delete()
            
        return {"message": f"Estudiante {ci} eliminado completamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/export-data")
async def export_data():
    if not db:
        raise HTTPException(status_code=500, detail="Firebase no configurado")
    try:
        estudiantes_ref = db.collection('estudiantes')
        docs = estudiantes_ref.stream()
        
        csv_buffer = io.StringIO()
        csv_writer = csv.writer(csv_buffer)
        csv_writer.writerow(["CI", "Nombres", "Apellidos", "Email", "Telefono", "Estado", "Fecha Registro", "URL CI", "URL Titulo", "URL Contrato"])
        
        for doc in docs:
            data = doc.to_dict()
            csv_writer.writerow([
                data.get("ci", doc.id),
                data.get("nombres", ""),
                data.get("apellidos", ""),
                data.get("email", ""),
                data.get("telefono_celular", ""),
                data.get("estado", ""),
                data.get("fecha_registro", ""),
                data.get("url_ci", ""),
                data.get("url_diploma", ""),
                data.get("url_contrato_final", "")
            ])
            
        csv_content = csv_buffer.getvalue()
        
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            zip_file.writestr("postulantes_ucb.csv", csv_content)
            
        zip_buffer.seek(0)
        
        headers = {'Content-Disposition': 'attachment; filename="exportacion_postulantes.zip"'}
        return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)
    except Exception as e:
        print(f"Error exportando datos: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/users")
async def create_admin(request: AdminCreateRequest):
    try:
        user = admin_auth.create_user(
            email=request.email,
            password=request.password,
            display_name=request.nombre
        )
        if db:
            db.collection("admins").document(user.uid).set({
                "email": request.email,
                "nombre": request.nombre
            })
        return {"message": f"Admin {user.email} creado con éxito", "uid": user.uid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/admin/users/password")
async def update_admin_password(request: AdminPasswordRequest):
    try:
        user = admin_auth.get_user_by_email(request.email)
        admin_auth.update_user(user.uid, password=request.new_password)
        return {"message": f"Contraseña actualizada para {request.email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/users/list")
async def list_admins():
    try:
        users = []
        for user in admin_auth.list_users().iterate_all():
            users.append({
                "uid": user.uid,
                "email": user.email,
                "nombre": user.display_name
            })
        return {"admins": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
