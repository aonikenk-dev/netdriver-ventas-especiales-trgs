import { Router } from 'express';
import { dbGetConfiguracion, dbSetConfiguracion } from '../db/configuracion.js';

const router = Router();
const MOCKS = process.env.USE_MOCKS !== 'false';

// Almacén en memoria para modo mock
const mockConfig: Record<string, string> = {
  PDF_DIR:           process.env.PDF_DIR ?? '',
  FACTURAS_DIR:      process.env.FACTURAS_DIR ?? '',
  CERTIFICADOS_DIR:  process.env.CERTIFICADOS_DIR ?? '',
  FACTURA_NRO_REGEX: process.env.FACTURA_NRO_REGEX ?? String.raw`F[-\s]?\d{2,8}`,
};

// GET /api/configuracion
router.get('/', async (_req, res) => {
  if (MOCKS) {
    return res.json({ config: { ...mockConfig } });
  }
  try {
    const config = await dbGetConfiguracion();
    res.json({ config });
  } catch (err) {
    console.error('[GET /configuracion]', err);
    res.status(500).json({ error: 'Error al leer la configuración' });
  }
});

// PUT /api/configuracion  { PDF_DIR: '...' }
router.put('/', async (req, res) => {
  const cambios = req.body as Record<string, string>;
  if (!cambios || typeof cambios !== 'object' || Array.isArray(cambios)) {
    return res.status(400).json({ error: 'Body debe ser un objeto { clave: valor }' });
  }

  if (MOCKS) {
    Object.assign(mockConfig, cambios);
    return res.json({ config: { ...mockConfig } });
  }

  try {
    const config = await dbSetConfiguracion(cambios);
    res.json({ config });
  } catch (err) {
    console.error('[PUT /configuracion]', err);
    res.status(500).json({ error: 'Error al guardar la configuración' });
  }
});

export default router;
