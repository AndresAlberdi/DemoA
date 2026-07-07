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
from firebase_admin import credentials, firestore, storage

from google import genai
from google.genai import types

# Cargar variables de entorno
load_dotenv()

# Inicializar Firebase
STORAGE_BUCKET = os.getenv("FIREBASE_STORAGE_BUCKET", f"{os.getenv('GOOGLE_CLOUD_PROJECT', 'demoa-c585c')}.appspot.com")
try:
    cred = credentials.Certificate(os.getenv("FIREBASE_CREDENTIALS_PATH", "config/firebase-adminsdk.json"))
    firebase_admin.initialize_app(cred, {
        'storageBucket': STORAGE_BUCKET
    })
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
            "ci_extraido": "Número de carnet de identidad encontrado",
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
        c.drawString(100, 700, "CONTRATO DE ADMISIÓN UCB")
        
        c.setFont("Helvetica", 12)
        c.drawString(100, 650, f"Por el presente documento, la Universidad Católica Boliviana")
        c.drawString(100, 630, f"admite al estudiante: {nombre_completo}")
        c.drawString(100, 610, f"Carnet de Identidad: {request.ci_estudiante}")
        c.drawString(100, 590, f"Estado Final: Aprobado.")
        
        c.drawString(100, 500, "Firma de la Institución")
        c.drawString(400, 500, "Firma del Estudiante")
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
