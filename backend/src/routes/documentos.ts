import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { dbGetValor } from '../db/configuracion.js';

const router = Router();
const MOCKS = process.env.USE_MOCKS !== 'false';

const PREFIJO: Record<string, string> = { factura: 'F', certificado: 'C' };
const TITULOS: Record<string, string> = {
  factura: 'Factura',
  certificado: 'Certificado de Fabricacion',
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
    'Documento de muestra. En produccion se sirve desde el directorio PDF_DIR configurado en Configuraciones.'
  );
  doc.end();
}

// GET /api/documentos/:tipo/:chasis  (factura | certificado)
router.get('/:tipo/:chasis', async (req, res) => {
  const { tipo, chasis } = req.params;
  const titulo = TITULOS[tipo];
  if (!titulo) return res.status(400).json({ error: 'Tipo invalido (factura | certificado)' });

  if (MOCKS) {
    return serveMockPdf(res, titulo, chasis);
  }

  // Leer PDF_DIR desde configuracion
  const pdfDir = await dbGetValor('PDF_DIR').catch(() => '');

  if (!pdfDir) {
    // Sin directorio configurado → PDF de aviso
    return serveMockPdf(res, titulo, chasis);
  }

  const prefijo = PREFIJO[tipo];
  const filePath = path.join(pdfDir, `${prefijo}${chasis}.pdf`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      error: `Archivo no encontrado: ${prefijo}${chasis}.pdf`,
      directorio: pdfDir,
    });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${tipo}-${chasis}.pdf"`);
  fs.createReadStream(filePath).pipe(res);
});

export default router;
