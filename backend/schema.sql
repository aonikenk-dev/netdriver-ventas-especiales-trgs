-- =============================================================================
-- netdriver_trgs — Schema local de prueba
-- Columnas alineadas con el esquema real de producción (gestor_autos,
-- gestor_tramites, gestor_personas) más las columnas nuevas del proyecto.
-- =============================================================================
-- Para conectar a la base del CLIENTE en PRODUCCIÓN:
--   1. Ejecutar solo la sección "TABLAS NUEVAS" (remitos + remito_tramites).
--   2. Ejecutar el ALTER TABLE de la sección "COLUMNAS NUEVAS EN TABLAS EXISTENTES".
--   3. NO ejecutar CREATE TABLE para gestor_autos / gestor_tramites / gestor_personas
--      (ya existen en producción).
--
-- Para base LOCAL de prueba: ejecutar este archivo completo.
-- =============================================================================

USE master;
GO
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'netdriver_trgs')
  CREATE DATABASE netdriver_trgs;
GO
USE netdriver_trgs;
GO

-- ---------------------------------------------------------------------------
-- TABLAS EXISTENTES (replican el esquema real del cliente — solo columnas usadas)
-- ---------------------------------------------------------------------------

IF OBJECT_ID('configuracion',      'U') IS NOT NULL DROP TABLE configuracion;
IF OBJECT_ID('gestor_formularios', 'U') IS NOT NULL DROP TABLE gestor_formularios;
IF OBJECT_ID('gestor_titulares',   'U') IS NOT NULL DROP TABLE gestor_titulares;
IF OBJECT_ID('remito_tramites',    'U') IS NOT NULL DROP TABLE remito_tramites;
IF OBJECT_ID('remitos',            'U') IS NOT NULL DROP TABLE remitos;
IF OBJECT_ID('VE_apoderados',      'U') IS NOT NULL DROP TABLE VE_apoderados;
IF OBJECT_ID('gestor_tramites',    'U') IS NOT NULL DROP TABLE gestor_tramites;
IF OBJECT_ID('gestor_autos',       'U') IS NOT NULL DROP TABLE gestor_autos;
IF OBJECT_ID('gestor_personas',    'U') IS NOT NULL DROP TABLE gestor_personas;
GO

-- gestor_personas: columnas reales + solo las extras que usamos
CREATE TABLE gestor_personas (
  id_persona       INT           IDENTITY(1,1) PRIMARY KEY,
  id_gestor        INT           NOT NULL,
  id_tipo_persona  INT           NOT NULL DEFAULT 9,
  juridica         TINYINT       NOT NULL DEFAULT 0,
  prenda           TINYINT       NOT NULL DEFAULT 0,
  Apellido         NVARCHAR(200),
  Nombre           NVARCHAR(200),
  tipocuit         NVARCHAR(4),
  nrocuit          NVARCHAR(16),
  CONSTRAINT UQ_persona_cuit_gestor UNIQUE (tipocuit, nrocuit, id_gestor)
);

-- gestor_autos: columnas reales que usamos (sin codigoClase — vive en tramites)
CREATE TABLE gestor_autos (
  id_auto             INT           IDENTITY(1,1) PRIMARY KEY,
  id_gestor           INT           NOT NULL DEFAULT 5452,
  facturaNro          NVARCHAR(250),
  facturaFecha        DATETIME,
  nroChasis           NVARCHAR(50)  NOT NULL,
  marcaChasis         NVARCHAR(50),
  modelo              NVARCHAR(50),
  nroMotor            NVARCHAR(50),
  marcaMotor          NVARCHAR(50),
  ano                 NVARCHAR(50),  -- nvarchar en producción
  codFabrica          NVARCHAR(50),
  facturaMonto        NVARCHAR(50),  -- nvarchar en producción
  certificadoFabrica  NVARCHAR(50)  NOT NULL DEFAULT ''
);

-- gestor_tramites: columnas reales + columnas nuevas del proyecto (ve_*)
CREATE TABLE gestor_tramites (
  id_tramite          INT           IDENTITY(1,1) PRIMARY KEY,
  id_gestor           INT           NOT NULL DEFAULT 5452,
  id_persona          INT           NOT NULL REFERENCES gestor_personas(id_persona),
  id_auto             INT           NOT NULL REFERENCES gestor_autos(id_auto),
  id_mandatario       INT           NOT NULL DEFAULT 0,
  CodigoClase         NVARCHAR(10)  NOT NULL,   -- 6801 nacional, 6802 importado
  Fecha               DATETIME      NOT NULL DEFAULT GETDATE(),
  Estado              TINYINT       NOT NULL DEFAULT 1,
  Fecha_Carga         DATETIME,                 -- nuestro creadoEn
  -- === COLUMNAS NUEVAS (agregar con ALTER TABLE en producción) ===
  ve_estado           NVARCHAR(20)  NOT NULL DEFAULT 'pendiente',
  traID               NVARCHAR(100),
  errorDesc           NVARCHAR(500),
  formularioNro01     NVARCHAR(50),
  formularioNro12     NVARCHAR(50),
  enviadoARemito      BIT           NOT NULL DEFAULT 0,
  Titulo              NVARCHAR(100)           -- RTO-{nroRemito} al enviar a remito
);

CREATE TABLE gestor_titulares (
  id_tramite   INT NOT NULL REFERENCES gestor_tramites(id_tramite),
  id_persona   INT NOT NULL REFERENCES gestor_personas(id_persona),
  porcentaje   INT NOT NULL DEFAULT 100,
  PRIMARY KEY (id_tramite, id_persona)
);

CREATE TABLE VE_apoderados (
  IDpersona_tit   INT NOT NULL REFERENCES gestor_personas(id_persona),
  IDpersona_apo   INT NOT NULL REFERENCES gestor_personas(id_persona),
  PRIMARY KEY (IDpersona_tit, IDpersona_apo)
);

CREATE TABLE gestor_formularios (
  id          INT           IDENTITY(1,1) PRIMARY KEY,
  id_tramite  INT           NOT NULL REFERENCES gestor_tramites(id_tramite),
  tipo        VARCHAR(20)   NOT NULL,   -- F01 | F01importado | F12
  numero      VARCHAR(50),
  pdfBase64   NVARCHAR(MAX)
);

-- ---------------------------------------------------------------------------
-- === TABLAS NUEVAS (únicas DDL del proyecto de migración) ===
-- ---------------------------------------------------------------------------

CREATE TABLE remitos (
  id         INT          IDENTITY(1,1) PRIMARY KEY,
  nroRemito  INT          NOT NULL UNIQUE,   -- número correlativo de negocio (RTO-XXXXXX en UI/PDF)
  creadoEn   DATETIME     NOT NULL DEFAULT GETDATE(),
  pdfUrl     VARCHAR(500),
  excelUrl   VARCHAR(500),
  estado     VARCHAR(10)  NOT NULL DEFAULT 'cerrado'
);

CREATE TABLE remito_tramites (
  idRemito   INT NOT NULL REFERENCES remitos(id),
  idTramite  INT NOT NULL REFERENCES gestor_tramites(id_tramite),
  PRIMARY KEY (idRemito, idTramite)
);
GO

CREATE TABLE configuracion (
  clave   VARCHAR(100) NOT NULL PRIMARY KEY,
  valor   NVARCHAR(500)
);
INSERT INTO configuracion (clave, valor) VALUES ('PDF_DIR', '');
GO

-- ---------------------------------------------------------------------------
-- PRODUCCIÓN — ALTER TABLE para agregar columnas nuevas a tablas existentes
-- ---------------------------------------------------------------------------
-- Ejecutar SOLO en el servidor de producción (donde las tablas ya existen):
--
-- ALTER TABLE gestor_tramites ADD ve_estado       NVARCHAR(20)  NOT NULL DEFAULT 'pendiente';
-- ALTER TABLE gestor_tramites ADD traID           NVARCHAR(100) NULL;
-- ALTER TABLE gestor_tramites ADD errorDesc       NVARCHAR(500) NULL;
-- ALTER TABLE gestor_tramites ADD formularioNro01 NVARCHAR(50)  NULL;
-- ALTER TABLE gestor_tramites ADD formularioNro12 NVARCHAR(50)  NULL;
-- ALTER TABLE gestor_tramites ADD enviadoARemito  BIT           NOT NULL DEFAULT 0;
-- ALTER TABLE gestor_tramites ADD Titulo          NVARCHAR(100) NULL;
-- ALTER TABLE remitos         ADD nroRemito       INT           NOT NULL UNIQUE;
-- (si ya existe numero: ejecutar script de migración nroRemito = ROW_NUMBER() OVER (ORDER BY id))
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- SEED DATA — equivalente a los mocks en memoria
-- ---------------------------------------------------------------------------
SET IDENTITY_INSERT gestor_personas ON;
INSERT INTO gestor_personas (id_persona, id_gestor, id_tipo_persona, Apellido, Nombre, tipocuit, nrocuit) VALUES
  (1,  5452, 9, 'MARTINEZ',    'JUAN CARLOS',    '20', '304050607'),
  (2,  5452, 0, 'TRANSPORTES PATAGONIA SA', '', '30', '712345678'),
  (3,  5452, 9, 'GOMEZ',       'ANA LUCIA',      '27', '298765432'),
  (4,  5452, 9, 'DIAZ',        'CARLOS ALBERTO', '20', '111222333'),
  (5,  5452, 9, 'FERREIRA',    'LUCIA BEATRIZ',  '27', '334455667'),
  (6,  5452, 0, 'RODRIGUEZ HERMANOS SRL', '', '30', '556677889'),
  (7,  5452, 9, 'PEREZ',       'MARTIN ALEJANDRO','20', '445566778'),
  (8,  5452, 9, 'VILLA',       'ROBERTO GERMAN', '20', '778899001'),
  (9,  5452, 9, 'CASTILLO',    'MARIA ELENA',    '27', '889900112'),
  (10, 5452, 9, 'ACOSTA',      'PABLO NICOLAS',  '20', '100110223'),
  (11, 5452, 9, 'MORENO',      'SILVIA GRACIELA','27', '221133445'),
  (12, 5452, 0, 'DISTRIBUIDORA NORTE SA', '', '30', '998877665'),
  (13, 5452, 9, 'IBARRA',      'MIGUEL ANGEL',   '20', '443355669'),
  (14, 5452, 9, 'LOPEZ',       'CARLOS DANIEL',  '20', '557788990'),
  (15, 5452, 9, 'SUAREZ',      'GABRIELA INES',  '27', '667788990');
SET IDENTITY_INSERT gestor_personas OFF;

SET IDENTITY_INSERT gestor_autos ON;
INSERT INTO gestor_autos (id_auto, facturaNro, facturaFecha, nroChasis, marcaChasis, modelo, nroMotor, marcaMotor, ano, codFabrica, facturaMonto, certificadoFabrica) VALUES
  (1,  'F-00123', '2026-05-02', '8AJFA01234X567890',  'TOYOTA',     'HILUX 4X4',  '2GD1234567',  'TOYOTA',     '2026', 'TOYHIL2026',  '32500000', 'CERT-44321'),
  (2,  'F-00124', '2026-05-03', '9BWZZZ377VT004251',  'VOLKSWAGEN', 'AMAROK',     'CDC9876543',  'VOLKSWAGEN', '2026', 'VWAMA2026',   '41200000', 'CERT-44322'),
  (3,  'F-00125', '2026-05-04', '8AD12345678901234',  'FORD',       'RANGER',     'P5AT778899',  'FORD',       '2025', 'FORRAN2025',  '38900000', 'CERT-44320'),
  (4,  'F-00126', '2026-05-05', '3CZRU5H57GM700001',  'HONDA',      'CR-V',       'K24W5001234', 'HONDA',      '2026', 'HONCRV2026',  '35600000', 'CERT-44323'),
  (5,  'F-00127', '2026-05-06', '8A1ZB01234Y123456',  'RENAULT',    'KANGOO',     'K9K002345',   'RENAULT',    '2026', 'RENKAN2026',  '21500000', 'CERT-44324'),
  (6,  'F-00128', '2026-05-07', 'VF3CCHNZPJS500001',  'PEUGEOT',   '208',        'EB2A500001',  'PEUGEOT',    '2026', 'PEU2082026',  '18900000', 'CERT-44325'),
  (7,  'F-00129', '2026-05-08', '8ZNEF1EA1GX900001',  'CHEVROLET',  'TRACKER',    'LVF900001',   'CHEVROLET',  '2026', 'CHETRA2026',  '29800000', 'CERT-44326'),
  (8,  'F-00130', '2026-05-09', '8AJFB01234X000001',  'NISSAN',     'FRONTIER',   'YD25900001',  'NISSAN',     '2026', 'NISFRO2026',  '45200000', 'CERT-44327'),
  (9,  'F-00131', '2026-05-10', 'JTDVT503X00700001',  'TOYOTA',     'COROLLA',    '2ZR700001',   'TOYOTA',     '2026', 'TOYCOR2026',  '24300000', 'CERT-44328'),
  (10, 'F-00132', '2026-05-11', 'WVWZZZ6RZ0W000001',  'VOLKSWAGEN', 'POLO',       'BLF000001',   'VOLKSWAGEN', '2026', 'VWPOL2026',   '19700000', 'CERT-44329'),
  (11, 'F-00133', '2026-05-12', '8AGZB0107R0000001',  'FIAT',       'CRONOS',     'FCA0000001',  'FIAT',       '2026', 'FIACRO2026',  '17400000', 'CERT-44330'),
  (12, 'F-00134', '2026-05-13', '1C4RJFBG0LC000001',  'JEEP',       'RENEGADE',   'B4EP000001',  'FCA',        '2026', 'JEEPRN2026',  '31100000', 'CERT-44331'),
  (13, 'F-00135', '2026-05-14', '8AFB10G24Q0000001',  'FORD',       'TERRITORY',  'HY15T000001', 'FORD',       '2026', 'FORDTR2026',  '28500000', 'CERT-44332'),
  (14, 'F-00136', '2026-05-15', 'WDD2050011R000001',  'MERCEDES',   'C200',       'OM274000001', 'MERCEDES',   '2026', 'MERC2002026', '71500000', 'CERT-44333'),
  (15, 'F-00137', '2026-05-16', '8ACKB02034A000001',  'HYUNDAI',    'TUCSON',     'G4NA000001',  'HYUNDAI',    '2026', 'HYUTUC2026',  '33200000', 'CERT-44334');
SET IDENTITY_INSERT gestor_autos OFF;

SET IDENTITY_INSERT gestor_tramites ON;
INSERT INTO gestor_tramites
  (id_tramite, id_auto, id_persona, CodigoClase, Fecha, Fecha_Carga, ve_estado, traID, errorDesc, formularioNro01, formularioNro12, enviadoARemito)
VALUES
  (1,  1,  1,  '6801', GETDATE(), DATEADD(hour,-1,GETDATE()),   'pendiente', NULL, NULL, NULL, NULL, 0),
  (2,  2,  2,  '6802', GETDATE(), DATEADD(hour,-24,GETDATE()),  'ok',        'TRA-998211', NULL, '01-887766', '12-554433', 0),
  (3,  3,  3,  '6801', GETDATE(), DATEADD(hour,-48,GETDATE()),  'error', NULL, 'rspID -14: CUIT del titular no coincide con AFIP', '01-112233', NULL, 0),
  (4,  4,  4,  '6802', GETDATE(), DATEADD(hour,-2,GETDATE()),   'pendiente', NULL, NULL, NULL, NULL, 0),
  (5,  5,  5,  '6801', GETDATE(), DATEADD(hour,-1,GETDATE()),   'pendiente', NULL, NULL, NULL, NULL, 0),
  (6,  6,  6,  '6802', GETDATE(), DATEADD(hour,-72,GETDATE()),  'ok',        'TRA-772341', NULL, '01-221100', '12-443322', 0),
  (7,  7,  7,  '6801', GETDATE(), DATEADD(hour,-96,GETDATE()),  'error', NULL, 'rspID -22: Codigo de fabrica inexistente en tabla TRGS', '01-334411', '12-556644', 0),
  (8,  8,  8,  '6801', GETDATE(), DATEADD(hour,-120,GETDATE()), 'ok',        'TRA-654321', NULL, '01-009988', '12-776655', 0),
  (9,  9,  9,  '6802', GETDATE(), DATEADD(minute,-30,GETDATE()),'pendiente', NULL, NULL, NULL, NULL, 0),
  (10, 10, 10, '6802', GETDATE(), DATEADD(hour,-144,GETDATE()), 'ok',        'TRA-321654', NULL, '01-118877', '12-998866', 0),
  (11, 11, 11, '6801', GETDATE(), DATEADD(hour,-168,GETDATE()), 'error', NULL, 'rspID -22: Codigo de fabrica inexistente en tabla TRGS', '01-667788', NULL, 0),
  (12, 12, 12, '6802', GETDATE(), DATEADD(hour,-192,GETDATE()), 'ok',        'TRA-246810', NULL, '01-335577', '12-668800', 0),
  (13, 13, 13, '6801', GETDATE(), DATEADD(hour,-1,GETDATE()),   'pendiente', NULL, NULL, NULL, NULL, 0),
  (14, 14, 14, '6802', GETDATE(), DATEADD(hour,-216,GETDATE()), 'error', NULL, 'rspID -30: El numero de chasis ya fue registrado en TRGS', '01-990011', '12-112233', 0),
  (15, 15, 15, '6801', GETDATE(), DATEADD(minute,-45,GETDATE()),'pendiente', NULL, NULL, NULL, NULL, 0);
SET IDENTITY_INSERT gestor_tramites OFF;

-- Titulares (porcentaje siempre 100)
INSERT INTO gestor_titulares (id_tramite, id_persona, porcentaje)
SELECT id_tramite, id_persona, 100 FROM gestor_tramites;

-- Formularios de tramites ok
SET IDENTITY_INSERT gestor_formularios ON;
INSERT INTO gestor_formularios (id, id_tramite, tipo, numero) VALUES
  (1,  2,  'F01importado', '01-887766'),
  (2,  2,  'F12',          '12-554433'),
  (3,  6,  'F01importado', '01-221100'),
  (4,  6,  'F12',          '12-443322'),
  (5,  8,  'F01',          '01-009988'),
  (6,  8,  'F12',          '12-776655'),
  (7,  10, 'F01importado', '01-118877'),
  (8,  10, 'F12',          '12-998866'),
  (9,  12, 'F01importado', '01-335577'),
  (10, 12, 'F12',          '12-668800');
SET IDENTITY_INSERT gestor_formularios OFF;
GO

PRINT 'Schema y seed data cargados correctamente.';
GO
