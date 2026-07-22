import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { findTramite, nextRemitoNumero, remitosStore } from '../mocks/data.js';
import type { GestorTramite } from '../../../shared/types/index.js';

const router = Router();

const GENERATED_DIR = path.resolve(process.cwd(), 'generated');
fs.mkdirSync(GENERATED_DIR, { recursive: true });

// Logo referenciado desde frontend/public — el backend se inicia desde backend/, así que
// process.cwd() = backend/ y ../frontend/public/logo-2026.png resuelve al archivo correcto.
const LOGO_PATH = path.resolve(process.cwd(), '../frontend/public/logo-2026.png');

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

  const tramites = tramiteIds
    .map(findTramite)
    .filter((t): t is GestorTramite => !!t);

  if (tramites.length === 0) {
    return res.status(404).json({ error: 'Ninguno de los tramites indicados existe' });
  }

  const { id, numero } = nextRemitoNumero();
  const pdfPath = path.join(GENERATED_DIR, `${numero}.pdf`);
  const xlsxPath = path.join(GENERATED_DIR, `${numero}.xlsx`);

  await generarPdfRemito(numero, tramites, pdfPath);
  await generarExcelRemito(tramites, xlsxPath);

  const remito = {
    id,
    numero,
    tramiteIds: tramites.map((t) => t.id),
    tramites: tramites.map((t) => ({
      id: t.id,
      nroChasis: t.auto.nroChasis,
      marcaChasis: t.auto.marcaChasis,
      modelo: t.auto.modelo,
      titular: t.titular.nombre,
      cuit: t.titular.cuit,
      traID: t.traID,
      certificadoFabrica: t.auto.certificadoFabrica ?? null,
      formularioNro01: t.formularioNro01 ?? null,
      formularioNro12: t.formularioNro12 ?? null,
    })),
    creadoEn: new Date().toISOString(),
    pdfUrl: `/files/${numero}.pdf`,
    excelUrl: `/files/${numero}.xlsx`,
  };
  remitosStore.push(remito);

  res.json({ remito });
});

async function generarPdfRemito(
  numero: string,
  tramites: GestorTramite[],
  destino: string
): Promise<void> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(destino);
    doc.pipe(stream);

    const MARGIN = 40;
    const PAGE_W = doc.page.width; // 595.28
    const CONTENT_W = PAGE_W - 2 * MARGIN;
    const HEADER_TOP = MARGIN;
    const LOGO_H = 52;

    // --- Logo (izquierda) ---
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, MARGIN, HEADER_TOP, { height: LOGO_H });
    }

    // --- Info remito (derecha, alineada a la derecha) ---
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const fechaStr = `${dd}/${mm}`;

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#111111')
      .text(`REMITO N° ${numero}`, MARGIN, HEADER_TOP, {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      });

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#333333')
      .text(`FECHA: ${fechaStr}`, MARGIN, HEADER_TOP + 19, {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      });

    doc
      .text(`TOTAL: ${tramites.length}`, MARGIN, HEADER_TOP + 35, {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      });

    // --- Tabla ---
    const TABLE_TOP = HEADER_TOP + LOGO_H + 14;
    const HDR_H = 18;
    const ROW_H = 16;

    // Anchos de columnas: suma = CONTENT_W (515)
    const W = {
      chasis: 195,
      certif: 155,
      f01: 75,
      get f12() { return CONTENT_W - this.chasis - this.certif - this.f01; },
    };

    const cols = [
      { x: MARGIN,                             w: W.chasis, label: 'CHASIS', align: 'left'  as const },
      { x: MARGIN + W.chasis,                  w: W.certif, label: 'CERTIF', align: 'left'  as const },
      { x: MARGIN + W.chasis + W.certif,       w: W.f01,   label: '01',     align: 'right' as const },
      { x: MARGIN + W.chasis + W.certif + W.f01, w: W.f12, label: '12',     align: 'right' as const },
    ];

    // Fondo del header
    doc.save();
    doc.rect(MARGIN, TABLE_TOP, CONTENT_W, HDR_H).fill('#eeeeee');
    doc.restore();

    // Texto del header
    cols.forEach((col) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#111111')
        .text(col.label, col.x + 4, TABLE_TOP + 5, {
          width: col.w - 8,
          align: col.align,
          lineBreak: false,
        });
    });

    // Borde exterior del header + separadores de columnas
    doc.save();
    doc.lineWidth(0.5);
    doc.rect(MARGIN, TABLE_TOP, CONTENT_W, HDR_H).stroke('#999999');
    cols.slice(1).forEach((col) => {
      doc
        .moveTo(col.x, TABLE_TOP)
        .lineTo(col.x, TABLE_TOP + HDR_H)
        .stroke('#999999');
    });
    doc.restore();

    // Filas de datos
    tramites.forEach((t, i) => {
      const y = TABLE_TOP + HDR_H + i * ROW_H;

      // Borde de fila + separadores de columnas
      doc.save();
      doc.lineWidth(0.3);
      doc.rect(MARGIN, y, CONTENT_W, ROW_H).stroke('#cccccc');
      cols.slice(1).forEach((col) => {
        doc.moveTo(col.x, y).lineTo(col.x, y + ROW_H).stroke('#cccccc');
      });
      doc.restore();

      // Valores de celda
      const values = [
        t.auto.nroChasis,
        t.auto.certificadoFabrica ?? '',
        t.formularioNro01 ?? '',
        t.formularioNro12 ?? '',
      ];

      cols.forEach((col, ci) => {
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(ci >= 2 ? '#1a5fb4' : '#111111')
          .text(values[ci], col.x + 4, y + 4, {
            width: col.w - 8,
            align: col.align,
            lineBreak: false,
          });
      });
    });

    doc.end();
    stream.on('finish', resolve);
  });
}

async function generarExcelRemito(
  tramites: GestorTramite[],
  destino: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Remito');

  sheet.columns = [
    { header: 'Chasis',           key: 'chasis', width: 22 },
    { header: 'Certif. Fábrica',  key: 'certif', width: 20 },
    { header: 'Form. 01',         key: 'f01',    width: 16 },
    { header: 'Form. 12',         key: 'f12',    width: 16 },
    { header: 'Titular',          key: 'titular', width: 28 },
    { header: 'CUIT',             key: 'cuit',   width: 16 },
    { header: 'traID',            key: 'traID',  width: 14 },
  ];

  tramites.forEach((t) => {
    sheet.addRow({
      chasis:  t.auto.nroChasis,
      certif:  t.auto.certificadoFabrica ?? '',
      f01:     t.formularioNro01 ?? '',
      f12:     t.formularioNro12 ?? '',
      titular: t.titular.nombre,
      cuit:    t.titular.cuit,
      traID:   t.traID ?? '',
    });
  });

  sheet.getRow(1).font = { bold: true };
  await workbook.xlsx.writeFile(destino);
}

export default router;
