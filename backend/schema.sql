-- =============================================================================
-- netdriver_trgs — Schema local de prueba
-- =============================================================================
-- Para conectar a la base del CLIENTE:
--   1. Ejecutar solo la seccion "TABLAS NUEVAS" (remitos + remito_tramites).
--   2. Ejecutar el ALTER TABLE de enviadoARemito en gestor_tramites.
--   3. Ajustar los nombres de columna en backend/src/db/tramites.ts si difieren.
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
-- TABLAS EXISTENTES (replican el esquema del cliente)
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

CREATE TABLE gestor_personas (
  id              INT           IDENTITY(1,1) PRIMARY KEY,
  idGestor        INT           NOT NULL,
  nombre          NVARCHAR(200) NOT NULL,
  cuit            VARCHAR(15)   NOT NULL,
  idTipoPersona   INT           NOT NULL DEFAULT 9,
  CONSTRAINT UQ_persona_cuit_gestor UNIQUE (cuit, idGestor)
);

CREATE TABLE gestor_autos (
  id                  INT           IDENTITY(1,1) PRIMARY KEY,
  facturaNro          VARCHAR(50),
  facturaFecha        DATE,
  nroChasis           VARCHAR(50)   NOT NULL,
  marcaChasis         VARCHAR(100),
  modelo              VARCHAR(100),
  nroMotor            VARCHAR(50),
  marcaMotor          VARCHAR(100),
  ano                 INT,
  codFabrica          VARCHAR(50),
  facturaMonto        DECIMAL(18,2),
  certificadoFabrica  VARCHAR(100),
  codigoClase         INT           NOT NULL    -- 6801 nacional, 6802 importado
);

CREATE TABLE gestor_tramites (
  id              INT           IDENTITY(1,1) PRIMARY KEY,
  idAuto          INT           NOT NULL REFERENCES gestor_autos(id),
  idPersona       INT           NOT NULL REFERENCES gestor_personas(id),
  estado          VARCHAR(20)   NOT NULL DEFAULT 'pendiente',
  traID           VARCHAR(100),
  errorDesc       NVARCHAR(500),
  formularioNro01 VARCHAR(50),
  formularioNro12 VARCHAR(50),
  creadoEn        DATETIME      NOT NULL DEFAULT GETDATE(),
  -- === COLUMNA NUEVA (agregar con ALTER TABLE en produccion) ===
  -- ALTER TABLE gestor_tramites ADD enviadoARemito BIT NOT NULL DEFAULT 0
  enviadoARemito  BIT           NOT NULL DEFAULT 0
);

CREATE TABLE gestor_titulares (
  idTramite   INT NOT NULL REFERENCES gestor_tramites(id),
  idPersona   INT NOT NULL REFERENCES gestor_personas(id),
  porcentaje  INT NOT NULL DEFAULT 100,
  PRIMARY KEY (idTramite, idPersona)
);

CREATE TABLE VE_apoderados (
  IDpersona_tit   INT NOT NULL REFERENCES gestor_personas(id),
  IDpersona_apo   INT NOT NULL REFERENCES gestor_personas(id),
  PRIMARY KEY (IDpersona_tit, IDpersona_apo)
);

CREATE TABLE gestor_formularios (
  id          INT           IDENTITY(1,1) PRIMARY KEY,
  idTramite   INT           NOT NULL REFERENCES gestor_tramites(id),
  tipo        VARCHAR(20)   NOT NULL,   -- F01 | F01importado | F12
  numero      VARCHAR(50),
  pdfBase64   NVARCHAR(MAX)
);

-- ---------------------------------------------------------------------------
-- === TABLAS NUEVAS (unicas DDL del proyecto de migracion) ===
-- ---------------------------------------------------------------------------

CREATE TABLE remitos (
  id        INT           IDENTITY(1,1) PRIMARY KEY,
  numero    VARCHAR(20)   NOT NULL UNIQUE,
  creadoEn  DATETIME      NOT NULL DEFAULT GETDATE(),
  pdfUrl    VARCHAR(500),
  excelUrl  VARCHAR(500)
);

CREATE TABLE remito_tramites (
  idRemito   INT NOT NULL REFERENCES remitos(id),
  idTramite  INT NOT NULL REFERENCES gestor_tramites(id),
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
-- SEED DATA — equivalente a los mocks en memoria
-- ---------------------------------------------------------------------------
SET IDENTITY_INSERT gestor_personas ON;
INSERT INTO gestor_personas (id, idGestor, nombre, cuit, idTipoPersona) VALUES
  (1,  5452, 'MARTINEZ, JUAN CARLOS',      '20304050607', 9),
  (2,  5452, 'TRANSPORTES PATAGONIA SA',   '30712345678', 0),
  (3,  5452, 'GOMEZ, ANA LUCIA',           '27298765432', 9),
  (4,  5452, 'DIAZ, CARLOS ALBERTO',       '20111222333', 9),
  (5,  5452, 'FERREIRA, LUCIA BEATRIZ',    '27334455667', 9),
  (6,  5452, 'RODRIGUEZ HERMANOS SRL',     '30556677889', 0),
  (7,  5452, 'PEREZ, MARTIN ALEJANDRO',    '20445566778', 9),
  (8,  5452, 'VILLA, ROBERTO GERMAN',      '20778899001', 9),
  (9,  5452, 'CASTILLO, MARIA ELENA',      '27889900112', 9),
  (10, 5452, 'ACOSTA, PABLO NICOLAS',      '20100110223', 9),
  (11, 5452, 'MORENO, SILVIA GRACIELA',    '27221133445', 9),
  (12, 5452, 'DISTRIBUIDORA NORTE SA',     '30998877665', 0),
  (13, 5452, 'IBARRA, MIGUEL ANGEL',       '20443355669', 9),
  (14, 5452, 'LOPEZ, CARLOS DANIEL',       '20557788990', 9),
  (15, 5452, 'SUAREZ, GABRIELA INES',      '27667788990', 9);
SET IDENTITY_INSERT gestor_personas OFF;

SET IDENTITY_INSERT gestor_autos ON;
INSERT INTO gestor_autos (id, facturaNro, facturaFecha, nroChasis, marcaChasis, modelo, nroMotor, marcaMotor, ano, codFabrica, facturaMonto, certificadoFabrica, codigoClase) VALUES
  (1,  'F-00123', '2026-05-02', '8AJFA01234X567890', 'TOYOTA',     'HILUX 4X4',  '2GD1234567',  'TOYOTA',     2026, 'TOYHIL2026',  32500000, 'CERT-44321', 6801),
  (2,  'F-00124', '2026-05-03', '9BWZZZ377VT004251', 'VOLKSWAGEN', 'AMAROK',     'CDC9876543',  'VOLKSWAGEN', 2026, 'VWAMA2026',   41200000, 'CERT-44322', 6802),
  (3,  'F-00125', '2026-05-04', '8AD12345678901234', 'FORD',       'RANGER',     'P5AT778899',  'FORD',       2025, 'FORRAN2025',  38900000, 'CERT-44320', 6801),
  (4,  'F-00126', '2026-05-05', '3CZRU5H57GM700001', 'HONDA',      'CR-V',       'K24W5001234', 'HONDA',      2026, 'HONCRV2026',  35600000, 'CERT-44323', 6802),
  (5,  'F-00127', '2026-05-06', '8A1ZB01234Y123456', 'RENAULT',    'KANGOO',     'K9K002345',   'RENAULT',    2026, 'RENKAN2026',  21500000, 'CERT-44324', 6801),
  (6,  'F-00128', '2026-05-07', 'VF3CCHNZPJS500001', 'PEUGEOT',   '208',        'EB2A500001',  'PEUGEOT',    2026, 'PEU2082026',  18900000, 'CERT-44325', 6802),
  (7,  'F-00129', '2026-05-08', '8ZNEF1EA1GX900001', 'CHEVROLET',  'TRACKER',    'LVF900001',   'CHEVROLET',  2026, 'CHETRA2026',  29800000, 'CERT-44326', 6801),
  (8,  'F-00130', '2026-05-09', '8AJFB01234X000001', 'NISSAN',     'FRONTIER',   'YD25900001',  'NISSAN',     2026, 'NISFRO2026',  45200000, 'CERT-44327', 6801),
  (9,  'F-00131', '2026-05-10', 'JTDVT503X00700001', 'TOYOTA',     'COROLLA',    '2ZR700001',   'TOYOTA',     2026, 'TOYCOR2026',  24300000, 'CERT-44328', 6802),
  (10, 'F-00132', '2026-05-11', 'WVWZZZ6RZ0W000001', 'VOLKSWAGEN', 'POLO',       'BLF000001',   'VOLKSWAGEN', 2026, 'VWPOL2026',   19700000, 'CERT-44329', 6802),
  (11, 'F-00133', '2026-05-12', '8AGZB0107R0000001', 'FIAT',       'CRONOS',     'FCA0000001',  'FIAT',       2026, 'FIACRO2026',  17400000, 'CERT-44330', 6801),
  (12, 'F-00134', '2026-05-13', '1C4RJFBG0LC000001', 'JEEP',       'RENEGADE',   'B4EP000001',  'FCA',        2026, 'JEEPRN2026',  31100000, 'CERT-44331', 6802),
  (13, 'F-00135', '2026-05-14', '8AFB10G24Q0000001', 'FORD',       'TERRITORY',  'HY15T000001', 'FORD',       2026, 'FORDTR2026',  28500000, 'CERT-44332', 6801),
  (14, 'F-00136', '2026-05-15', 'WDD2050011R000001', 'MERCEDES',   'C200',       'OM274000001', 'MERCEDES',   2026, 'MERC2002026', 71500000, 'CERT-44333', 6802),
  (15, 'F-00137', '2026-05-16', '8ACKB02034A000001', 'HYUNDAI',    'TUCSON',     'G4NA000001',  'HYUNDAI',    2026, 'HYUTUC2026',  33200000, 'CERT-44334', 6801);
SET IDENTITY_INSERT gestor_autos OFF;

SET IDENTITY_INSERT gestor_tramites ON;
INSERT INTO gestor_tramites (id, idAuto, idPersona, estado, traID, errorDesc, formularioNro01, formularioNro12, creadoEn, enviadoARemito) VALUES
  (1,  1,  1,  'pendiente', NULL,         NULL,                                            NULL,         NULL,         DATEADD(hour,-1,GETDATE()),   0),
  (2,  2,  2,  'ok',        'TRA-998211', NULL,                                            '01-887766',  '12-554433',  DATEADD(hour,-24,GETDATE()),  0),
  (3,  3,  3,  'error',     NULL,         'rspID -14: CUIT del titular no coincide con AFIP', '01-112233', NULL,       DATEADD(hour,-48,GETDATE()),  0),
  (4,  4,  4,  'pendiente', NULL,         NULL,                                            NULL,         NULL,         DATEADD(hour,-2,GETDATE()),   0),
  (5,  5,  5,  'pendiente', NULL,         NULL,                                            NULL,         NULL,         DATEADD(hour,-1,GETDATE())+30, 0),
  (6,  6,  6,  'ok',        'TRA-772341', NULL,                                            '01-221100',  '12-443322',  DATEADD(hour,-72,GETDATE()),  0),
  (7,  7,  7,  'error',     NULL,         'rspID -22: Codigo de fabrica inexistente en tabla TRGS', '01-334411', '12-556644', DATEADD(hour,-96,GETDATE()), 0),
  (8,  8,  8,  'ok',        'TRA-654321', NULL,                                            '01-009988',  '12-776655',  DATEADD(hour,-120,GETDATE()), 0),
  (9,  9,  9,  'pendiente', NULL,         NULL,                                            NULL,         NULL,         DATEADD(minute,-30,GETDATE()), 0),
  (10, 10, 10, 'ok',        'TRA-321654', NULL,                                            '01-118877',  '12-998866',  DATEADD(hour,-144,GETDATE()), 0),
  (11, 11, 11, 'error',     NULL,         'rspID -22: Codigo de fabrica inexistente en tabla TRGS', '01-667788', NULL, DATEADD(hour,-168,GETDATE()), 0),
  (12, 12, 12, 'ok',        'TRA-246810', NULL,                                            '01-335577',  '12-668800',  DATEADD(hour,-192,GETDATE()), 0),
  (13, 13, 13, 'pendiente', NULL,         NULL,                                            NULL,         NULL,         DATEADD(hour,-1,GETDATE())+20, 0),
  (14, 14, 14, 'error',     NULL,         'rspID -30: El numero de chasis ya fue registrado en TRGS', '01-990011', '12-112233', DATEADD(hour,-216,GETDATE()), 0),
  (15, 15, 15, 'pendiente', NULL,         NULL,                                            NULL,         NULL,         DATEADD(minute,-45,GETDATE()), 0);
SET IDENTITY_INSERT gestor_tramites OFF;

-- Titulares (porcentaje siempre 100)
INSERT INTO gestor_titulares (idTramite, idPersona, porcentaje)
SELECT id, idPersona, 100 FROM gestor_tramites;

-- Formularios de tramites ok
SET IDENTITY_INSERT gestor_formularios ON;
INSERT INTO gestor_formularios (id, idTramite, tipo, numero) VALUES
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
