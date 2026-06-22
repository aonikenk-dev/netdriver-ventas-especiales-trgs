import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { findTramite, nextRemitoNumero, remitosStore } from '../mocks/data.js';

const router = Router();

const GENERATED_DIR = path.resolve(process.cwd(), 'generated');
fs.mkdirSync(GENERATED_DIR, { recursive: true });

// GET /api/remitos
router.get('/', (_req, res) => {
  res.json({ remitos: remitosStore });
});

// POST /api/remitos  { tramiteIds: number[] }
router.post('/', async (req, res) => {
  const { tramiteIds } = req.body as { tramiteIds: number[] };
  if (!Array.isArray(tramiteIds) || tramiteIds.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array "tramiteIds" con al menos un tramite' });
  }

  const tramites = tramiteIds.map(findTramite).filter((t): t is NonNullable<typeof t> => !!t);
  if (tramites.length === 0) {
    return res.status(404).json({ error: 'Ninguno de los tramites indicados existe' });
  }

  const { id, numero } = nextRemitoNumero();
  const pdfPath = path.join(GENERATED_DIR, `${numero}.pdf`);
  const xlsxPath = path.join(GENERATED_DIR, `${numero}.xlsx`);

  await generarPdfRemito(numero, tramites, pdfPath);
  await generarExcelRemito(numero, tramites, xlsxPath);

  const remito = {
    id,
    numero,
    tramiteIds: tramites.map((t) => t.id),
    creadoEn: new Date().toISOString(),
  };
  remitosStore.push(remito);

  res.json({
    remito: {
      ...remito,
      pdfUrl: `/files/${numero}.pdf`,
      excelUrl: `/files/${numero}.xlsx`,
    },
  });
});

async function generarPdfRemito(
  numero: string,
  tramites: ReturnType<typeof findTramite>[],
  destino: string
): Promise<void> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(destino);
    doc.pipe(stream);

    doc.fontSize(18).text(`Remito ${numero}`, { align: 'center' });
    doc.fontSize(10).fillColor('gray').text('Gestoria 5452 - netdriver.com.ar', { align: 'center' });
    doc.moveDown(2);

    tramites.forEach((t, i) => {
      if (!t) return;
      doc
        .fillColor('black')
        .fontSize(12)
        .text(`${i + 1}. Chasis ${t.auto.nroChasis} - ${t.auto.marcaChasis} ${t.auto.modelo}`);
      doc.fontSize(10).fillColor('gray').text(`   Titular: ${t.titular.nombre} (CUIT ${t.titular.cuit})`);
      doc.text(`   Tramite traID: ${t.traID ?? 'sin asignar'}`);
      doc.moveDown(0.5);
    });

    doc.end();
    stream.on('finish', resolve);
  });
}

async function generarExcelRemito(
  numero: string,
  tramites: ReturnType<typeof findTramite>[],
  destino: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Remito');

  sheet.columns = [
    { header: 'Chasis', key: 'chasis', width: 22 },
    { header: 'Marca', key: 'marca', width: 16 },
    { header: 'Modelo', key: 'modelo', width: 18 },
    { header: 'Titular', key: 'titular', width: 28 },
    { header: 'CUIT', key: 'cuit', width: 16 },
    { header: 'traID', key: 'traID', width: 16 },
  ];

  tramites.forEach((t) => {
    if (!t) return;
    sheet.addRow({
      chasis: t.auto.nroChasis,
      marca: t.auto.marcaChasis,
      modelo: t.auto.modelo,
      titular: t.titular.nombre,
      cuit: t.titular.cuit,
      traID: t.traID ?? '',
    });
  });

  sheet.getRow(1).font = { bold: true };
  void numero;
  await workbook.xlsx.writeFile(destino);
}

export default router;
