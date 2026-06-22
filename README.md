# NetDriver | Proceso Ventas Especiales integrado con WS TRGS

Migración del sistema de Ventas Especiales TRGS de stack legacy (ASP/VBScript + PHP) a una arquitectura moderna basada en React + Node.js, manteniendo integración con el Web Service SOAP de TRGS (SUATS) sin modificaciones al servicio externo.

---

## Contexto

El sistema gestiona el proceso de inscripción de vehículos nuevos (formulario 01-Digital) para la empresa **Gestoría id 5452** operando bajo la plataforma `netdriver.com.ar`. El operador carga un Excel con los datos de cada vehículo, el sistema los procesa, los almacena en la base de datos propia y los envía al Web Service de TRGS para generar el trámite registral. Al finalizar, genera un remito con los formularios correspondientes.

---

## Stack Legacy (reemplazado)

| Capa | Tecnología | Función |
|---|---|---|
| Entrada | Excel manual | Carga de datos de vehículos (columnas A–U) |
| Backend 1 | ASP / VBScript (IIS) | Lee SQL Server, construye XML del trámite |
| Backend 2 | PHP (Apache) | Sanitiza campos, llama al WS vía SOAP 1.1 |
| Base de datos | SQL Server | Tablas `gestor_*` y `VE_apoderados` |
| WS Externo | TRGS / SUATS | Generación del trámite registral (intocable) |
| Salida | PDF + Excel manual | Remito generado manualmente |

**Problemas del stack anterior:**
- Dos capas de backend acopladas (ASP → PHP) sin API definida
- XML construido por concatenación de strings en VBScript
- Sin control de errores estructurado — fallas silenciosas
- Sin historial ni trazabilidad de trámites fallidos
- Generación de remitos completamente manual

---

## Nuevo Stack

| Capa | Tecnología | Función |
|---|---|---|
| Frontend | React + Vite | UI del operador: carga, listado, PDFs, remitos |
| Backend | Node.js + Express | API REST, parser Excel, sanitización, cliente SOAP |
| Base de datos | SQL Server (existente) | Mismas tablas, sin migración de datos |
| WS Externo | TRGS / SUATS | Sin cambios — mismo protocolo SOAP 1.1 |

### Librerías clave

```
Backend (Node.js + TypeScript):
  express + @types/express     servidor HTTP
  mssql + @types/mssql         conexión SQL Server existente
  multer + @types/multer        recepción archivo Excel (multipart/form-data)
  xlsx                         SheetJS — parseo Excel server-side en Node
  soap                         node-soap — cliente SOAP para TRGS WS
  pdfkit                       generación PDF remitos
  exceljs                      generación Excel remitos
  tsx / ts-node                ejecución TypeScript en desarrollo
  typescript
 
Frontend (React + Vite + TypeScript):
  react + vite
  typescript
  axios                        cliente HTTP
  react-router-dom + @types
  zustand                      estado global
  tailwindcss                  utilidades CSS
  shadcn/ui                    componentes base (Button, Input, Table, Badge, Toast, Dialog, Select)
  lucide-react                 iconografía
 
Compartido:
  /shared/types                interfaces trgDatosTramite, GestorTramite, etc.
```

---

## Flujo del sistema

```
1. Operador carga Excel (A–U)
        ↓
2. Node.js parsea columnas → reglas de negocio
   · J+K+L = codFabrica
   · chasis[0] = '8' → nacional (6801) | importado (6802)
   · tipoUso=1 · id_gestor=5452 · porcentaje=100%
        ↓
3. Upsert gestor_autos + gestor_personas (por CUIT + id_gestor)
   INSERT gestor_tramites (estado: pendiente)
   INSERT gestor_titulares
        ↓
4. Operador ingresa n° de formulario 01 / 12 y presiona ENVIAR SUATS
        ↓
5. Node.js sanitiza campos → llama WS TRGS:
   eco() → abrir_sesion() → generar_tramite_01() → cerrar_sesion()
        ↓
6. WS responde traID → UPDATE gestor_tramites (estado: ok)
   obtener_formularios() → INSERT gestor_formularios
        ↓
7. Operador descarga PDFs:
   · F01 / F01-importado / F12 → del WS
   · Factura (F{chasis}) / Certificado (C{chasis}) → directorio local
   · Enmienda / DDJJ → del WS
        ↓
8. Operador genera remito (PDF + Excel) con los trámites seleccionados
```

---

## Estructura del proyecto

```
netdriver-ventas-especiales-trgs/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── excel.js          # POST /api/excel/import
│   │   │   ├── tramites.js       # GET, POST /api/tramites
│   │   │   ├── pdfs.js           # GET /api/pdfs/:tipo/:chasis
│   │   │   └── remitos.js        # POST /api/remitos
│   │   ├── services/
│   │   │   ├── trgsService.js    # cliente SOAP (eco→sesion→tramite→cerrar)
│   │   │   ├── sanitize.js       # filterOperatorErrors migrado de PHP
│   │   │   └── excelParser.js    # mapeo columnas A–U + reglas de negocio
│   │   ├── db/
│   │   │   └── index.js          # conexión mssql a SQL Server existente
│   │   └── app.js
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/           # Input, Button, Table, Badge, Toast
    │   ├── pages/
    │   │   ├── Tramites.jsx      # pantalla principal del operador
    │   │   ├── PDFs.jsx          # visor de documentos
    │   │   └── Remitos.jsx       # módulo de remitos
    │   ├── api/
    │   │   └── client.js         # axios instance
    │   └── store/
    │       └── useTramitesStore.js
    ├── .env.example
    └── package.json
```

---

## Base de datos

La base de datos SQL Server **no se modifica**. El backend se conecta directamente a las tablas existentes.

| Tabla | Descripción |
|---|---|
| `gestor_autos` | Datos del vehículo — alimentada desde Excel A–U |
| `gestor_personas` | Titulares y apoderados — upsert por CUIT + id_gestor |
| `VE_apoderados` | Relación titular ↔ apoderado |
| `gestor_tramites` | Estado del trámite + traID devuelto por TRGS |
| `gestor_titulares` | FK tramite + persona, porcentaje siempre 100% |
| `gestor_formularios` | Formularios 01 / 01importado / 12 post-WS OK |

---

## Variables de entorno

```bash
# backend/.env

# SQL Server
DB_HOST=
DB_PORT=1433
DB_NAME=
DB_USER=
DB_PASSWORD=

# TRGS Web Service
TRGS_URL=https://www.trgs.com.ar:443/service/index.php?wsdl
TRGS_URL_TESTING=http://testingvdc.trgs.com.ar/service/index.php?wsdl
TRGS_USW_ID=000005
TRGS_USW_PASSWORD=
TRGS_USW_HASH=
TRGS_HTTP_USER=
TRGS_HTTP_PASS=
TRGS_ID_EMPRESA=5452

# PDFs locales
PDF_DIR=/ruta/al/directorio/pdfs

# App
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

```bash
# frontend/.env
VITE_API_URL=http://localhost:3001
```

---

## Instalación y desarrollo

```bash
# Backend
cd backend
npm install
cp .env.example .env   # completar variables
npm run dev            # nodemon en puerto 3001

# Frontend
cd frontend
npm install
cp .env.example .env   # completar VITE_API_URL
npm run dev            # vite en puerto 5173
```

---

## Web Service TRGS — referencia rápida

El WS opera bajo SOAP 1.1. La sesión HTTP debe mantenerse entre llamadas.

```
Flujo obligatorio por trámite:
  eco() → abrir_sesion() → [operación] → cerrar_sesion()

Endpoints productivos:  https://www.trgs.com.ar:443/service/index.php
Endpoint testing:       http://testingvdc.trgs.com.ar/service/index.php
WSDL:                   {endpoint}?wsdl

Respuesta exitosa:  rspID = 1
Respuesta error:    rspID < 0  →  ver rspDescrip
```

Operaciones implementadas: `eco`, `abrir_sesion`, `generar_tramite_01`, `obtener_formularios`, `cancelar_tramite_01`, `cerrar_sesion`.

Ver `TRGS_WS_V1_00instructivo.pdf` en `/docs` para referencia completa de parámetros y tablas de códigos (Anexo I–V).

---

## Estimación

| Área | Horas |
|---|---|
| Backend — Node.js | 78 hs |
| Frontend — React | 58 hs |
| QA + UAT | 37 hs |
| Infra / Deploy | 17 hs |
| **Total** | **190 – 210 hs** |

---

## Estado del proyecto

Ver [GitHub Projects → Kanban](https://github.com/orgs/aonikenk-dev/projects/3/views/1) para el estado actual de las tareas por épica.

---

*Desarrollado por [aonikenk.dev](https://aonikenk.dev) · Software · Branding · Solutions · Patagonia, Argentina*