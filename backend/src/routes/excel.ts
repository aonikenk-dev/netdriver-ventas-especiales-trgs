import { Router } from 'express';
import multer from 'multer';
import { parseExcelBuffer } from '../services/excelParser.js';
import { addTramites } from '../mocks/data.js';
import { getPool, sql } from '../db/index.js';
import { dbUpsertPersona } from '../db/personas.js';
import { dbUpsertAuto } from '../db/autos.js';
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

  const { tramites: parsedTramites, errores } = parseExcelBuffer(req.file.buffer);

  if (MOCKS) {
    const creados = addTramites(parsedTramites);
    return res.json({ tramites: creados, errores });
  }

  // --- DB: upsert persona → upsert auto → insert tramite → insert titular ---
  const creados = [];
  const erroresDb: ExcelImportRowError[] = [...errores];
  const pool = await getPool().catch((err: unknown) => { throw err; });

  for (let i = 0; i < parsedTramites.length; i++) {
    const t = parsedTramites[i];
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
        fila: i + 2, // fila 1 = encabezado
        motivo: err instanceof Error ? err.message : String(err),
        datos: {
          chasis:   t.auto?.nroChasis,
          titular:  t.titular?.nombre,
          cuit:     t.titular?.cuit,
        },
      });
    }
  }

  res.json({ tramites: creados, errores: erroresDb });
});

export default router;
