# Plan de Desarrollo: Sistema de Admisiones UCB (Demo A)

Este documento detalla los pasos de implementación en Antigravity utilizando puramente GCP/Firebase (Always Free) y un backend en Python (FastAPI).

## 1. Configuración de Infraestructura (GCP / Firebase)

* **Firebase Project:** Crea un proyecto en Firebase Console, llamado DemoA.
* **Authentication:** Habilita "Google" (para estudiantes) y "Email/Password" (para administradores simulados).
* **Firestore Database:** Crea la base de datos en modo producción. 
* **Storage:** Habilita Firebase Storage para recibir el PDF del CI, Titulo de Bachiller y el Contrato final.
* **Credenciales:** Descarga el archivo JSON de la cuenta de servicio de Firebase para conectarlo con tu backend en Python (Antigravity).

## 2. Modelado de Datos (Firestore)

El identificador principal será el Carnet de Identidad (CI), lo que evita duplicidades. Los ejemplos que se colocan a continuación deben poder parametrizarse desde el Administrador.

* **Colección `estudiantes`:**
    * Document ID: `[CI_BOLIVIANO]` (String único).
    * Campos: `nombres`, `apellidos`, `email`, `uid_firebase`, `estado` (Pendiente, Docs_En_Revision, Habilitado_Conocimientos, Habilitado_Ingles, Aprobado, Rechazado), `url_ci`, `url_certificado`, `telefono_celular`.
* **Colección `examenes`:**
    * Document ID: Generado automáticamente.
    * Campos: `ci_estudiante`, `tipo` (Conocimientos / Ingles), `nota`, `fecha`, `aprobado` (Booleano).
* **Colección `logs_auditoria`:**
    * Document ID: Timestamp.
    * Campos: `actor` (Email o CI), `accion` (Ej: "Documentos aprobados", "Examen habilitado"), `fecha`, `detalles`.

## 3. Desarrollo en Antigravity (Frontend & Backend)

### Módulo de Estudiantes
1.  **Pantalla de Registro/Login:** Login con Google. Si es nuevo, redirigir a un formulario que exija el número de CI y teléfono.
2.  **Validación de CI:** Antes de guardar, el backend de Antigravity debe consultar Firestore para asegurar que el CI no exista.
3.  **Upload de Documentos:** Formulario para subir CI y Titulo de Bachiller a Firebase Storage. Validar que sea PDF solamente, alertar sobre tamaño y alertar que debe ser ESCANEADO, no FOTOGRAFÍA, el tamaño no debe ser mayor a 5 MB, no debe estar inclinado, preferentemente a 300 dpi en blanco y negro, para que la lectura sea mejor.
    * *Validación IA:* Una vez subidos los archivos, el frontend llama a un endpoint del backend (FastAPI) que descarga el documento y utiliza la API de Gemini para validarlo directamente, actualizando Firestore con los resultados.
4.  **Portal del Postulante:**
    * Pestaña "Preparación" (Contenido estático o traído desde Firestore).
    * Botones de acceso a exámenes (habilitados condicionalmente según el `estado` en Firestore).
5. Cambio de contraseña, si se ha inscrito con correo/contraseña.

### Módulo de Administradores
1.  **Dashboard:** Tabla (DataGrid) que lista todos los documentos de la colección `estudiantes`.
2.  **Acciones Rápidas:**
    * Botón "Aprobar/Rechazar Documentos" (Cambia el estado y genera log).
    * Botón "Habilitar Reintento" (Elimina el registro de examen fallido y devuelve el estado al paso anterior).
3.  **Generador de Zip y CSV:** Script en Python (Antigravity) que use las librerías `zipfile` y `csv` para empaquetar los URLs de Storage y descargar la base de datos de Firestore.
4.  **Upload de Contrato:** Input para subir el PDF firmado escaneado, asociándolo al CI del alumno.
5. Diferentes parametrizaciones de los datos anteriores. Cambio de contraseña.
6. Borrado de datos de un estudiante, para liberar espacio (con alerta de borrado).

## 4. Orquestación e Integraciones (Backend FastAPI)

Toda la lógica de orquestación se manejará mediante endpoints en el backend de Python:

1.  **Flujo IA - Revisión de Documentos:**
    * *Endpoint:* `/api/verify-docs`
    * *Proceso:* El backend descarga los archivos desde Firebase Storage, los envía a la API de Gemini (con un prompt estricto de limpieza de datos), y compara los resultados. Actualiza Firestore.
2.  **Flujo - Links de Examen (Meet):**
    * *Endpoint:* `/api/schedule-exam`
    * *Proceso:* Para este demo, el backend simulará la creación del Meet, retornando un link de reunión estático y enviando la confirmación, desencadenado por el cambio de estado en Firestore.
3.  **Flujo - Cita Final y Generación de Contrato:**
    * *Endpoint:* `/api/generate-contract`
    * *Proceso:* El backend utilizará una librería nativa de Python para generar un PDF combinando los datos y notas, y lo subirá a Firebase Storage.
