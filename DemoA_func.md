# Plan de Desarrollo: Sistema de Admisiones UCB (Demo A)

Este documento detalla los pasos de implementación en Antigravity utilizando GCP/Firebase (Always Free) y n8n como motor de integración.

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
    * *Trigger a n8n:* Una vez subidos los URLs, Antigravity hace un `POST` a un Webhook de n8n para que la IA los valide (escribir la función que se ejecuta cuando el estudiante sube su CI y Titulo de Bachiller, la cual debe hacer un POST con las URLs de los archivos apuntando directamente a la URL de producción de la n8n (https://n8n-707096513295.us-east1.run.app/webhook/...).
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

## 4. Orquestación e Integraciones (n8n)

Se deben crear 3 flujos (Workflows) principales en n8n iniciados por un nodo "Webhook":

1.  **Flujo IA - Revisión de Documentos:**
    * *Trigger:* Webhook de Antigravity recibe URLs de los PDFs.
    * *Proceso:* n8n descarga los archivos, los envía a la API de Gemini (con un prompt estricto de limpieza de datos y extracción de nombres/fechas), y compara los resultados con los datos ingresados.
    * *Salida:* n8n actualiza el documento en Firestore y envía un email al admin de "Documentos listos para revisión".
2.  **Flujo - Links de Examen (Meet):**
    * *Trigger:* Cambio de estado en Firestore a "Habilitado_Conocimientos" o "Habilitado_Ingles".
    * *Proceso:* Crea evento en Google Calendar con link de Meet asociado. Envía notificación por Gmail y Google Chat al estudiante.
3.  **Flujo - Cita Final y Generación de Contrato:**
    * *Trigger:* Cambio de estado a "Aprobado".
    * *Proceso:* Crea la cita en Calendar presencial. n8n utiliza un nodo de HTML/Markdown a PDF para inyectar las notas y los datos del estudiante en una plantilla predefinida y lo sube a Firebase Storage.

