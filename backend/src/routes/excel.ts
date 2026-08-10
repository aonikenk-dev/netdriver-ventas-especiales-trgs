import { Router } from 'express';
import multer from 'multer';
import { parseExcelBuffer } from '../services/excelParser.js';
import { validarImport } from '../services/excelValidations.js';
import { addTramites } from '../mocks/data.js';
import { getPool, sql } from '../db/index.js';
import { dbUpsertPersona } from '../db/personas.js';
import { dbUpsertAuto, dbGetChasisExistentes } from '../db/autos.js';
import { dbInsertTramite, dbFindTramite } from '../db/tramites.js';
import type { ExcelImportRowError } from '../../../shared/types/index.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const MOCKS = process.env.USE_MOCKS !== 'false';

// POST /api/excel/import
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibio ningun archivo (campo "file")' });
  }

  const { tramites: parsedTramites, errores: erroresParseo } = parseExcelBuffer(req.file.buffer);

  // Checker de chasis existentes: mock store o DB según entorno
  const chasisChecker = MOCKS
    ? async (nros: string[]) => {
        const { tramitesStore } = await import('../mocks/data.js');
        const existing = new Set(tramitesStore.map((t) => t.auto.nroChasis.trim().toUpperCase()));
        return nros.filter((n) => existing.has(n.trim().toUpperCase()));
      }
    : dbGetChasisExistentes;

  const { validos, errores: erroresValidacion } = await validarImport(parsedTramites, { chasisChecker });
  const errores: ExcelImportRowError[] = [...erroresParseo, ...erroresValidacion];

  if (MOCKS) {
    const tramitesSinMeta = validos.map(({ _fila, ...t }) => t);
    const creados = addTramites(tramitesSinMeta);
    return res.json({ tramites: creados, errores });
  }

  // --- DB: upsert persona → upsert auto → insert tramite → insert titular ---
  const creados = [];
  const erroresDb: ExcelImportRowError[] = [...errores];
  const pool = await getPool().catch((err: unknown) => { throw err; });

  for (const t of validos) {
    try {
      const idPersona = await dbUpsertPersona(t.titular);
      const idAuto = await dbUpsertAuto(t.auto);
      const idTramite = await dbInsertTramite(idAuto, idPersona);

      await pool.request()
        .input('idTramite', sql.Int, idTramite)
        .input('idPersona', sql.Int, idPersona)
        .query(
          'INSERT INTO gestor_titulares (idTramite, idPersona, porcentaje) VALUES (@idTramite, @idPersona, 100)'
        );

      const tramiteCreado = await dbFindTramite(idTramite);
      if (tramiteCreado) creados.push(tramiteCreado);
    } catch (err) {
      erroresDb.push({
        fila: t._fila,
        motivo: err instanceof Error ? err.message : String(err),
        datos: {
          chasis:  t.auto?.nroChasis,
          titular: t.titular?.nombre,
          cuit:    t.titular?.cuit,
        },
      });
    }
  }

  res.json({ tramites: creados, errores: erroresDb });
});

export default router;
