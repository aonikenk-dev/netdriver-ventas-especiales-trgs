import { Router } from 'express';
import multer from 'multer';
import { parseExcelBuffer } from '../services/excelParser.js';
import { addTramites } from '../mocks/data.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/excel/import
router.post('/import', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibio ningun archivo (campo "file")' });
  }

  const { tramites, errores } = parseExcelBuffer(req.file.buffer);
  const creados = addTramites(tramites);

  res.json({ tramites: creados, errores });
});

export default router;
