import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { dbGetValor } from '../db/configuracion.js';

const router = Router();
const MOCKS = process.env.USE_MOCKS !== 'false';

const CONFIG_KEY: Record<string, string> = {
  factura:      'FACTURAS_DIR',
  certificado:  'CERTIFICADOS_DIR',
};

const TITULOS: Record<string, string> = {
  factura:      'Factura',
  certificado:  'Certificado de Fabricacion',
};

function serveMockPdf(res: import('express').Response, titulo: string, chasis: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${titulo.toLowerCase()}-${chasis}.pdf"`);
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  doc.fontSize(20).text(`${titulo} (documento de muestra)`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Chasis: ${chasis}`);
  doc.text('Gestoria: 5452 - netdriver.com.ar');
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`);
  doc.moveDown();
  doc.fontSize(10).fillColor('gray').text(
    'Documento de muestra. En produccion se sirve desde el directorio configurado en Configuraciones.'
  );
  doc.end();
}

// Busca {chasis}.pdf en baseDir y en sus subdirectorios inmediatos (subcarpetas de fecha YYYY-MM-DD).
// Devuelve la ruta completa del primer archivo encontrado, o null si no existe.
function buscarArchivo(baseDir: string, chasis: string): string | null {
  const fileName = `${chasis}.pdf`;

  // Primero buscar directamente en la raíz del directorio base
  const directPath = path.join(baseDir, fileName);
  if (fs.existsSync(directPath)) return directPath;

  // Luego buscar en cada subcarpeta de un nivel (las subcarpetas de fecha)
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(baseDir, entry.name, fileName);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch { /* baseDir inaccesible o no existe */ }

  return null;
}

// GET /api/documentos/:tipo/:chasis  (factura | certificado)
router.get('/:tipo/:chasis', async (req, res) => {
  const { tipo, chasis } = req.params;
  const titulo = TITULOS[tipo];
  if (!titulo) return res.status(400).json({ error: 'Tipo invalido (factura | certificado)' });

  if (MOCKS) {
    return serveMockPdf(res, titulo, chasis);
  }

  const configKey = CONFIG_KEY[tipo];
  const baseDir = await dbGetValor(configKey).catch(() => '');

  if (!baseDir) {
    return serveMockPdf(res, titulo, chasis);
  }

  const filePath = buscarArchivo(baseDir, chasis);

  if (!filePath) {
    return res.status(404).json({
      error: `Archivo no encontrado: ${chasis}.pdf`,
      directorio: baseDir,
    });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${tipo}-${chasis}.pdf"`);
  fs.createReadStream(filePath).pipe(res);
});

export default router;
