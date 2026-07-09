#!/bin/bash
# Script para levantar el backend de DemoA

echo "Iniciando el servidor backend FastAPI..."

# Activar el entorno virtual si existe
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Instalar dependencias si faltan (opcional)
# pip install -r requirements.txt

# Ejecutar el servidor con uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
