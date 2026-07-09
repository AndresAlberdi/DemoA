import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import base64

# Evitar que main.py intente conectarse a Firebase o Vertex en la inicialización importando el archivo con mocks
with patch('firebase_admin.initialize_app'), \
     patch('firebase_admin.firestore.client'), \
     patch('firebase_admin.storage.bucket'), \
     patch('google.genai.Client'):
    from main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "DemoA Backend is running!"}

@patch('main.db')
@patch('main.client')
def test_verify_docs(mock_genai_client, mock_db):
    mock_doc_ref = MagicMock()
    mock_db.collection.return_value.document.return_value = mock_doc_ref

    mock_response = MagicMock()
    mock_response.text = '{"ci_extraido": "1234567-1A", "es_boliviano": true, "tiene_fotografia": true, "nombres_extraidos": "Juan Perez", "anverso_y_reverso_presentes": true}'
    mock_genai_client.models.generate_content.return_value = mock_response

    payload = {
        "ci_estudiante": "1234567-1A",
        "archivo_b64": "data:application/pdf;base64," + base64.b64encode(b"dummy pdf content").decode('utf-8')
    }

    response = client.post("/api/verify-docs", json=payload)
    assert response.status_code == 200
    assert response.json()["estado_nuevo"] == "Habilitado_Conocimientos"
    
@patch('main.db')
@patch('main.client')
def test_verify_diploma(mock_genai_client, mock_db):
    mock_doc_ref = MagicMock()
    mock_db.collection.return_value.document.return_value = mock_doc_ref

    mock_response = MagicMock()
    mock_response.text = '{"es_titulo_bachiller": true}'
    mock_genai_client.models.generate_content.return_value = mock_response

    payload = {
        "ci_estudiante": "1234567-1A",
        "archivo_b64": "data:application/pdf;base64," + base64.b64encode(b"dummy pdf content").decode('utf-8')
    }

    response = client.post("/api/verify-diploma", json=payload)
    assert response.status_code == 200
    assert response.json()["estado_nuevo"] == "Habilitado_Conocimientos"

@patch('main.db')
def test_schedule_exam(mock_db):
    mock_doc_ref = MagicMock()
    mock_db.collection.return_value.document.return_value = mock_doc_ref

    payload = {
        "ci_estudiante": "1234567-1A",
        "tipo_examen": "Conocimientos"
    }

    response = client.post("/api/schedule-exam", json=payload)
    assert response.status_code == 200
    assert "meet_url" in response.json()

@patch('main.db')
@patch('main.bucket')
def test_generate_contract(mock_bucket, mock_db):
    mock_doc_ref = MagicMock()
    mock_doc = MagicMock()
    mock_doc.exists = True
    mock_doc.to_dict.return_value = {"nombres": "Juan", "apellidos": "Perez"}
    mock_doc_ref.get.return_value = mock_doc
    mock_db.collection.return_value.document.return_value = mock_doc_ref
    
    mock_blob = MagicMock()
    mock_blob.public_url = "https://example.com/contrato.pdf"
    mock_bucket.blob.return_value = mock_blob

    payload = {
        "ci_estudiante": "1234567-1A"
    }

    response = client.post("/api/generate-contract", json=payload)
    assert response.status_code == 200
    assert response.json()["contrato_url"] == "https://example.com/contrato.pdf"

@patch('main.db')
@patch('main.bucket')
def test_delete_student(mock_bucket, mock_db):
    mock_db.collection.return_value.document.return_value.delete = MagicMock()
    mock_bucket.list_blobs.return_value = []
    
    response = client.delete("/api/delete-student/1234567-1A")
    assert response.status_code == 200
    assert "eliminado completamente" in response.json()["message"]

@patch('main.admin_auth')
def test_create_admin(mock_admin_auth):
    mock_user = MagicMock()
    mock_user.email = "admin@example.com"
    mock_user.uid = "uid123"
    mock_admin_auth.create_user.return_value = mock_user

    payload = {
        "email": "admin@example.com",
        "password": "password123",
        "nombre": "Admin User"
    }

    response = client.post("/api/admin/users", json=payload)
    assert response.status_code == 200
    assert response.json()["uid"] == "uid123"
