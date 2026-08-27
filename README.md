# NetDriver | Proceso Ventas Especiales integrado con WS TRGS

Migración del sistema de Ventas Especiales TRGS de stack legacy (ASP/VBScript + PHP) a una arquitectura moderna basada en React + Node.js, manteniendo integración con el Web Service SOAP de TRGS (SUATS) sin modificaciones al servicio externo ni a la base de datos SQL Server existente.

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
| Frontend | React + Vite + TypeScript | UI del operador: carga, listado, documentos, remitos |
| Backend | Node.js + Express + TypeScript | API REST, parser Excel, sanitización, cliente SOAP |
| Base de datos | SQL Server (existente) | Mismas tablas `gestor_*`, más `remitos` / `remito_tramites` |
| WS Externo | TRGS / SUATS | Sin cambios — mismo protocolo SOAP 1.1, nuevo dominio |

### Librerías clave

```
Backend (Node.js + TypeScript):
  express + @types/express     servidor HTTP
  mssql + @types/mssql         conexión SQL Server existente
  multer + @types/multer        recepción de archivos (Excel y ZIP)
  xlsx                         SheetJS — parseo Excel server-side
  soap                         node-soap — cliente SOAP para TRGS WS
  pdfkit                       generación PDF remitos
  exceljs                      generación Excel remitos
  pdf-lib                      manipulación PDFs subidos
  pdfjs-dist                   extracción de texto PDF (detección de chasis)
  adm-zip                      extracción de ZIPs en bulk upload
  dotenv                       carga de variables de entorno

Frontend (React + Vite + TypeScript):
  react + vite
  tailwindcss                  utilidades CSS
  shadcn/ui                    componentes base (Button, Input, Table, Badge,
                               Toast, Dialog, Select, Separator, Card)
  lucide-react                 iconografía (única librería de iconos)
  axios                        cliente HTTP
  react-router-dom             navegación SPA
  zustand                      estado global

Compartido:
  /shared/types/index.ts       interfaces GestorTramite, Remito, TrgRespuesta, etc.
```

---

## Flujo del sistema

```
1. Operador carga Excel (.xlsx) desde la UI
        ↓
2. POST /api/excel/import (multipart/form-data)
   excelParser.ts procesa columnas A–U:
   · J+K+L concatenados = codFabrica
   · nroChasis[0] = '8'  → codigoClase 6801 (nacional)
   · nroChasis[0] ≠ '8'  → codigoClase 6802 (importado)
   · tipoUso = 1 · id_gestor = 5452 · porcentaje = 100%
   excelValidations.ts valida cada fila (chasis, CUIT, factura, etc.)
        ↓
3. Upsert gestor_autos (por codFabrica)
   Upsert gestor_personas (por CUIT + id_gestor = 5452)
   INSERT gestor_tramites (estado: 'pendiente')
   INSERT gestor_titulares (porcentaje: 100%)
   El frontend muestra la lista de trámites creados + errores por fila
        ↓
4. Operador revisa / edita datos (ModalTramiteDetalle)
   Operador ingresa n° formulario 01 (o 01importado) y n° 12 por fila
   Operador selecciona filas y presiona ENVIAR SUATS
        ↓
5. POST /api/tramites/enviar
   sanitize.ts aplica filterOperatorErrors (migrado de PHP)
   buildPayload.ts construye el payload SOAP:
   · Detecta persona jurídica por prefijo de CUIT (30/33/34)
     → tdcID=0, traSexo='P', razón social completa en traApellido
   · Persona física: tdcID=9, traSexo según CUIT (27=F, resto=M)
   · Parsea facturaNro (ej. 'A0065 - 00697780') en ticID + codigoPuntoVenta + elpFacNum
   · datosTitulares envuelto en { trgArrayTitularesTramites: ... } (formato SOAP NuSOAP)
   trgsService.ts ejecuta la cadena SOAP:
     eco() → abrir_sesion() → generar_tramite_01() → cerrar_sesion()
        ↓
6. WS TRGS (servicehabitualistas.suats.com.ar) responde:
   rspID = 1  → traID → UPDATE gestor_tramites (estado: 'ok', traID)
                         obtener_formularios() → INSERT gestor_formularios
   rspID < 0  → UPDATE gestor_tramites (estado: 'error', errorDesc)
                trgsErrores.ts traduce el código a mensaje amigable
        ↓
7. Frontend actualiza la fila:
   Badge 'ok' + traID  |  Badge 'error' + leyenda + acción sugerida
        ↓
8. Operador descarga documentos (ModalDocumentos):
   · F01 / F01-importado / F12 / Enmienda / DDJJ
       → GET /api/documentos/formulario?tramiteId=&tipo=  (del WS TRGS, PDF base64)
   · Factura (F{chasis}.pdf)
       → GET /api/documentos/factura/:chasis              (directorio FACTURAS_DIR)
   · Certificado (C{chasis}.pdf)
       → GET /api/documentos/certificado/:chasis          (directorio CERTIFICADOS_DIR)
   Facturas y Certificados se cargan masivamente con POST /api/upload
   (soporta .zip con subdirectorios y PDFs sueltos; detecta chasis por nombre y por texto del PDF)
        ↓
9. Operador agrega trámites 'ok' al remito activo (POST /api/tramites/:id/remito)
   Operador cierra el remito (PATCH /api/remitos/:id/cerrar)
   Backend genera PDF y Excel del remito en backend/generated/
        ↓
10. Operador descarga remito (ModalRemito):
    · PDF → GET /files/RTO-{nro}.pdf   (archivo generado por pdfkit)
    · Excel → GET /files/RTO-{nro}.xlsx (archivo generado por exceljs)
```

---

## Estructura del proyecto

```
netdriver-ventas-especiales-trgs/
├── shared/
│   └── types/
│       └── index.ts              # interfaces compartidas backend ↔ frontend
│
├── backend/
│   ├── src/
│   │   ├── app.ts                # Express, middlewares, rutas, static /files
│   │   ├── routes/
│   │   │   ├── excel.ts          # POST /api/excel/import
│   │   │   ├── tramites.ts       # GET/POST /api/tramites + /enviar + /remito
│   │   │   ├── documentos.ts     # GET /api/documentos/:tipo/:chasis + formularios WS
│   │   │   ├── remitos.ts        # CRUD /api/remitos + generación PDF/Excel
│   │   │   ├── upload.ts         # POST /api/upload (PDFs sueltos y ZIP)
│   │   │   └── configuracion.ts  # GET/PUT /api/configuracion
│   │   ├── services/
│   │   │   ├── trgsService.ts    # cliente SOAP: eco → sesion → tramite → cerrar
│   │   │   ├── buildPayload.ts   # construye payload generar_tramite_01
│   │   │   ├── sanitize.ts       # filterOperatorErrors migrado de PHP
│   │   │   ├── excelParser.ts    # mapeo columnas A–U + reglas de negocio
│   │   │   ├── excelValidations.ts # validaciones por fila del Excel
│   │   │   └── trgsErrores.ts    # tabla de códigos error TRGS con mensajes
│   │   ├── db/
│   │   │   ├── index.ts          # pool mssql + helper sql
│   │   │   ├── tramites.ts       # queries gestor_tramites / gestor_formularios
│   │   │   ├── autos.ts          # queries gestor_autos
│   │   │   ├── personas.ts       # queries gestor_personas
│   │   │   ├── remitos.ts        # queries remitos / remito_tramites
│   │   │   └── configuracion.ts  # queries tabla configuracion
│   │   └── mocks/
│   │       └── data.ts           # datos en memoria para USE_MOCKS=true
│   ├── scripts/
│   │   ├── test-trgs.ts          # diagnóstico WSDL + eco + abrir_sesion
│   │   └── find-api-path.ts      # exploración de endpoints (diagnóstico)
│   ├── generated/                # PDFs y Excels de remitos generados (gitignored)
│   ├── schema.sql                # DDL de las 2 tablas nuevas + seed de configuracion
│   ├── reset.sql                 # script para reiniciar la DB de desarrollo
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Tramites.tsx      # pantalla principal del operador
    │   │   ├── Documentos.tsx    # visor de documentos y carga masiva
    │   │   ├── Remitos.tsx       # gestión de remitos
    │   │   ├── Configuracion.tsx # rutas de directorios PDF
    │   │   └── Logs.tsx          # historial de logs del sistema
    │   ├── components/
    │   │   ├── UploadExcel.tsx        # drag-and-drop del Excel
    │   │   ├── UploadZone.tsx         # carga masiva de PDFs / ZIP
    │   │   ├── ModalTramiteDetalle.tsx # ver y editar datos de un trámite
    │   │   ├── ModalDocumentos.tsx    # descarga de formularios y PDFs locales
    │   │   ├── ModalRemito.tsx        # detalle y descarga de remito (PDF/Excel)
    │   │   ├── ModalLogs.tsx          # logs de un trámite específico
    │   │   ├── ModalErrorExcel.tsx    # errores de validación del Excel
    │   │   ├── layout/               # Layout, Nav, etc.
    │   │   └── ui/                   # componentes shadcn/ui
    │   ├── api/
    │   │   └── client.ts             # axios instance apuntando a VITE_API_URL
    │   └── store/
    │       └── useTramitesStore.ts   # estado global con zustand
    ├── public/
    │   └── logo-2026.png
    ├── .env.example
    └── package.json
```

---

## Base de datos

La base de datos SQL Server **no se modifica** excepto por las dos tablas nuevas de remitos.

### Tablas existentes (sin cambios)

| Tabla | Descripción |
|---|---|
| `gestor_autos` | Datos del vehículo — alimentada desde Excel A–U |
| `gestor_personas` | Titulares — upsert por CUIT + id_gestor |
| `VE_apoderados` | Relación titular ↔ apoderado |
| `gestor_tramites` | Estado del trámite + traID devuelto por TRGS |
| `gestor_titulares` | FK tramite + persona, porcentaje siempre 100% |
| `gestor_formularios` | Formularios 01 / 01importado / 12 post-WS OK |

### Tablas nuevas (creadas por `schema.sql`)

| Tabla | Descripción |
|---|---|
| `remitos` | Número correlativo, estado (abierto/cerrado), URLs de PDF y Excel |
| `remito_tramites` | Relación N:M entre remitos y gestor_tramites |

### Comandos Docker útiles

```bash
# Iniciar SQL Server local
docker run -e "ACCEPT_EULA=Y" -e "SA_PASSWORD=Dev@1234!" \
  -p 1433:1433 --name sqlserver -d mcr.microsoft.com/mssql/server:2022-latest

# Aplicar schema (crea DB + tablas nuevas + seed configuración)
docker cp backend/schema.sql sqlserver:/tmp/schema.sql
docker exec sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "Dev@1234!" -C -i /tmp/schema.sql

# Resetear DB de desarrollo
docker cp backend/reset.sql sqlserver:/tmp/reset.sql
docker exec sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "Dev@1234!" -C -d netdriver_trgs -i /tmp/reset.sql
```

---

## Variables de entorno

```bash
# backend/.env

# Modo — true = datos en memoria (sin DB ni WS), false = real
USE_MOCKS=false

# SQL Server
DB_HOST=localhost
DB_PORT=1433
DB_NAME=netdriver_trgs
DB_USER=sa
DB_PASSWORD=Dev@1234!

# TRGS Web Service (SOAP 1.1 — NuSOAP/PHP)
# Dominio migrado desde trgs.com.ar a suats.com.ar
TRGS_URL=https://servicehabitualistas.suats.com.ar/service/index.php?wsdl
TRGS_USW_ID=000005
TRGS_USW_PASSWORD=
TRGS_USW_HASH=
TRGS_ID_EMPRESA=5452
# HTTP Basic Auth (opcional — el servidor actual no la requiere)
TRGS_HTTP_USER=
TRGS_HTTP_PASS=

# Directorios de PDFs locales (soportan subcarpetas por fecha YYYY-MM-DD)
FACTURAS_DIR=/ruta/facturas
CERTIFICADOS_DIR=/ruta/certificados

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
npm run dev            # tsx en modo watch, puerto 3001

# Frontend
cd frontend
npm install
cp .env.example .env   # completar VITE_API_URL
npm run dev            # vite en puerto 5173
```

### Modo mock (sin DB ni WS)

Con `USE_MOCKS=true` el backend opera completamente en memoria:
- Los trámites se generan con datos de ejemplo
- La integración SOAP simula latencia y errores aleatorios (15% de falla)
- Los documentos devuelven PDFs de muestra generados con pdfkit
- Los remitos generan archivos reales en `backend/generated/`

---

## Web Service TRGS — referencia técnica

```
Protocolo:         SOAP 1.1 (NuSOAP / PHP)
Endpoint producción: https://servicehabitualistas.suats.com.ar/service/index.php
                   IP: 119.8.76.167
WSDL:              {endpoint}?wsdl
TLS:               certificado wildcard *.suats.com.ar
                   NODE_TLS_REJECT_UNAUTHORIZED=0 en desarrollo
```

**Flujo obligatorio por trámite:**
```
eco()          → verifica disponibilidad del servidor (raw HTTPS, input:null en WSDL)
abrir_sesion() → retorna ingID (token de sesión)
generar_tramite_01(uswID, ingID, datos) → retorna traID si rspID=1
obtener_formularios(uswID, ingID, F12, nroForm, nroTramite) → PDF base64
cerrar_sesion(uswID, ingID) → SIEMPRE, incluso si hubo error
```

**Respuestas:**
- `rspID = 1` → operación exitosa
- `rspID < 0` → error; ver `rspDescrip` y tabla en `trgsErrores.ts`

**Estructura del payload `datos` (generar_tramite_01):**

El servidor usa NuSOAP (PHP); los arrays deben enviarse con wrapper explícito:
```
datosDelTramite:           { ttrID, frmID_12, traAnio, ticID, codigoPuntoVenta,
                             elpFacNum, elpMoneda, elpImporte, ... }
datosTitulares:            { trgArrayTitularesTramites: { frmID, tdcID, traCuit,
                             traNombre, traApellido, traSexo, traPorcentaje, ... } }
datosVehiculo:             { cerID, cerNumeroCC (nroChasis), cerTipo (F|I) }
datosCedulasAzul:          {}
datosApoderados:           {}
datosTitularesDJApoderados:{}
datosGuardaHabitual:       { ghCalle, ghNumero, ghCP, ... }
datosPrestamo:             { tdcID, ptrDocumento, ptrNombre, ptrMonto }
datosAutopartes:           { formaPago: '' }
```

**Detección de persona jurídica:**

El prefijo del CUIT es autoritativo (no el campo `idTipoPersona` de la DB, que puede ser incorrecto):
- CUIT `30xxx` / `33xxx` / `34xxx` → empresa → `tdcID=0`, `traSexo='P'`, razón social en `traApellido`
- CUIT `27xxx` → mujer → `tdcID=9`, `traSexo='F'`
- Resto → varón → `tdcID=9`, `traSexo='M'`

---

## Módulo de documentos

Los documentos se obtienen de dos fuentes distintas según el tipo:

| Tipo | Fuente | Ruta |
|---|---|---|
| F01 / F01importado / F12 / Enmienda / DDJJ | WS TRGS (PDF base64) | `GET /api/documentos/formulario` |
| Factura | Directorio `FACTURAS_DIR` (archivo `{chasis}.pdf`) | `GET /api/documentos/factura/:chasis` |
| Certificado de fábrica | Directorio `CERTIFICADOS_DIR` (archivo `{chasis}.pdf`) | `GET /api/documentos/certificado/:chasis` |

### Carga masiva de PDFs (`POST /api/upload`)

Acepta PDFs sueltos o un archivo `.zip` con subdirectorios. Para cada archivo:
1. Intenta inferir el chasis desde el nombre del archivo (regex configurable `FACTURA_NRO_REGEX`)
2. Si falla, extrae el texto del PDF con `pdfjs-dist` y busca el nro de chasis en el contenido
3. Guarda el archivo en `FACTURAS_DIR` o `CERTIFICADOS_DIR` según el tipo declarado

Los directorios soportan subcarpetas con formato `YYYY-MM-DD`; la búsqueda recorre el directorio base y sus subdirectorios inmediatos.

---

## Módulo de remitos

Un remito agrupa un conjunto de trámites con estado `ok` para su entrega física.

**Estados:** `abierto` → `cerrado`. Solo existe un remito abierto a la vez.

**Generación de archivos:**
- Al cerrar un remito (`PATCH /api/remitos/:id/cerrar`), el backend genera:
  - `backend/generated/RTO-{nro}.pdf` — tabla con chasis, certificado, nros de formulario
  - `backend/generated/RTO-{nro}.xlsx` — mismos datos en Excel para archivo
- Los archivos se sirven via `express.static` en `/files/`
- El frontend los descarga via `fetch` + `URL.createObjectURL` (no `window.open` directo, para capturar errores 404)

**Numeración correlativa:** garantizada por `MAX(nroRemito) + 1` en SQL (no usa `IDENTITY`).

---

## Scripts de diagnóstico

```bash
# Verificar conectividad con el WS TRGS:
# 1. Descarga del WSDL (TLS + opciones)
# 2. eco() (raw HTTPS)
# 3. abrir_sesion() + cerrar_sesion() (valida credenciales)
cd backend
npx tsx scripts/test-trgs.ts
```

El script `find-api-path.ts` sirve para explorar endpoints en caso de cambio de servidor.

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
