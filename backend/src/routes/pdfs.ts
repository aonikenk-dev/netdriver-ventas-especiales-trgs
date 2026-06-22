import { Router } from 'express';
import PDFDocument from 'pdfkit';

const router = Router();

const TITULOS: Record<string, string> = {
  factura: 'Factura',
  certificado: 'Certificado de Fabricacion',
};

// GET /api/pdfs/:tipo/:chasis  (factura | certificado)
// PROTOTIPO: en el sistema real estos son archivos fisicos en PDF_DIR
// nombrados F{chasis} / C{chasis}. Aca se genera un PDF de muestra al vuelo.
router.get('/:tipo/:chasis', (req, res) => {
  const { tipo, chasis } = req.params;
  const titulo = TITULOS[tipo];
  if (!titulo) return res.status(400).json({ error: 'Tipo de PDF invalido (factura | certificado)' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${tipo}-${chasis}.pdf"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  doc.fontSize(20).text(`${titulo} (documento de muestra)`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Chasis: ${chasis}`);
  doc.text('Gestoria: 5452 - netdriver.com.ar');
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`);
  doc.moveDown();
  doc.fontSize(10).fillColor('gray').text(
    'Este documento es un mock para validacion de prototipo. En produccion se sirve desde el directorio PDF_DIR.'
  );
  doc.end();
});

export default router;
