-- reset.sql — limpia todos los datos operativos para prueba desde cero
-- Ejecutar: docker exec sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Dev@1234!" -C -d netdriver_trgs -i /tmp/reset.sql

USE netdriver_trgs;

DELETE FROM remito_tramites;
DELETE FROM remitos;
DELETE FROM gestor_formularios;
DELETE FROM gestor_titulares;
DELETE FROM VE_apoderados;
DELETE FROM gestor_tramites;
DELETE FROM gestor_autos;
DELETE FROM gestor_personas;

DBCC CHECKIDENT ('remitos',         RESEED, 0);
DBCC CHECKIDENT ('gestor_formularios', RESEED, 0);
DBCC CHECKIDENT ('gestor_tramites', RESEED, 0);
DBCC CHECKIDENT ('gestor_autos',    RESEED, 0);
DBCC CHECKIDENT ('gestor_personas', RESEED, 0);

PRINT 'Base limpia. IDs reseteados a 1.';
GO
