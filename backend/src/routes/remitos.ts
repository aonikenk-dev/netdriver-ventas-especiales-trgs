import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { findTramite, findRemitoAbierto, nextRemitoNumero, remitosStore } from '../mocks/data.js';
import {
  dbListarRemitos, dbCrearRemitoVacio, dbFinalizarRemito, dbAbrirRemito,
  dbGetRemitoAbierto, dbGetRemitoBasic, dbGetRemitoTramites,
} from '../db/remitos.js';
import type { RemitoTramite } from '../../../shared/types/index.js';

const router = Router();
const MOCKS = process.env.USE_MOCKS !== 'false';

const GENERATED_DIR = path.resolve(process.cwd(), 'generated');
fs.mkdirSync(GENERATED_DIR, { recursive: true });

const LOGO_PATH = path.resolve(process.cwd(), '../frontend/public/logo-2026.png');

// ---------------------------------------------------------------------------
// Helpers PDF/Excel — usan RemitoTramite[] (campos planos)
// ---------------------------------------------------------------------------
async function generarPdfRemito(
  nroRemito: number,
  tramites: RemitoTramite[],
  destino: string
): Promise<void> {
  const numero = `RTO-${nroRemito}`;
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const stream = fs.createWriteStream(destino);
    doc.pipe(stream);

    const MARGIN = 40;
    const PAGE_W = doc.page.width;
    const CONTENT_W = PAGE_W - 2 * MARGIN;
    const HEADER_TOP = MARGIN;
    const LOGO_H = 52;

    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, MARGIN, HEADER_TOP, { height: LOGO_H });
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const fechaStr = `${dd}/${mm}`;

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111111')
      .text(`REMITO N° ${numero}`, MARGIN, HEADER_TOP, { width: CONTENT_W, align: 'right', lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor('#333333')
      .text(`FECHA: ${fechaStr}`, MARGIN, HEADER_TOP + 19, { width: CONTENT_W, align: 'right', lineBreak: false });
    doc.text(`TOTAL: ${tramites.length}`, MARGIN, HEADER_TOP + 35, { width: CONTENT_W, align: 'right', lineBreak: false });

    const TABLE_TOP = HEADER_TOP + LOGO_H + 14;
    const HDR_H = 18;
    const ROW_H = 16;

    const W = {
      chasis: 195, certif: 155, f01: 75,
      get f12() { return CONTENT_W - this.chasis - this.certif - this.f01; },
    };

    const cols = [
      { x: MARGIN,                              w: W.chasis, label: 'CHASIS', align: 'left'  as const },
      { x: MARGIN + W.chasis,                   w: W.certif, label: 'CERTIF', align: 'left'  as const },
      { x: MARGIN + W.chasis + W.certif,        w: W.f01,   label: '01',     align: 'right' as const },
      { x: MARGIN + W.chasis + W.certif + W.f01, w: W.f12,  label: '12',     align: 'right' as const },
    ];

    doc.save();
    doc.rect(MARGIN, TABLE_TOP, CONTENT_W, HDR_H).fill('#eeeeee');
    doc.restore();
    cols.forEach((col) => {
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111')
        .text(col.label, col.x + 4, TABLE_TOP + 5, { width: col.w - 8, align: col.align, lineBreak: false });
    });
    doc.save();
    doc.lineWidth(0.5);
    doc.rect(MARGIN, TABLE_TOP, CONTENT_W, HDR_H).stroke('#999999');
    cols.slice(1).forEach((col) => {
      doc.moveTo(col.x, TABLE_TOP).lineTo(col.x, TABLE_TOP + HDR_H).stroke('#999999');
    });
    doc.restore();

    tramites.forEach((t, i) => {
      const y = TABLE_TOP + HDR_H + i * ROW_H;
      doc.save();
      doc.lineWidth(0.3);
      doc.rect(MARGIN, y, CONTENT_W, ROW_H).stroke('#cccccc');
      cols.slice(1).forEach((col) => {
        doc.moveTo(col.x, y).lineTo(col.x, y + ROW_H).stroke('#cccccc');
      });
      doc.restore();
      const values = [t.nroChasis, t.certificadoFabrica ?? '', t.formularioNro01 ?? '', t.formularioNro12 ?? ''];
      cols.forEach((col, ci) => {
        doc.font('Helvetica').fontSize(8)
          .fillColor(ci >= 2 ? '#1a5fb4' : '#111111')
          .text(values[ci], col.x + 4, y + 4, { width: col.w - 8, align: col.align, lineBreak: false });
      });
    });

    doc.end();
    stream.on('finish', resolve);
  });
}

async function generarExcelRemito(tramites: RemitoTramite[], destino: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Remito');
  sheet.columns = [
    { header: 'Chasis',          key: 'chasis',  width: 22 },
    { header: 'Certif. Fábrica', key: 'certif',  width: 20 },
    { header: 'Form. 01',        key: 'f01',     width: 16 },
    { header: 'Form. 12',        key: 'f12',     width: 16 },
    { header: 'Titular',         key: 'titular', width: 28 },
    { header: 'CUIT',            key: 'cuit',    width: 16 },
    { header: 'traID',           key: 'traID',   width: 14 },
  ];
  tramites.forEach((t) => {
    sheet.addRow({
      chasis:  t.nroChasis,
      certif:  t.certificadoFabrica ?? '',
      f01:     t.formularioNro01 ?? '',
      f12:     t.formularioNro12 ?? '',
      titular: t.titular,
      cuit:    t.cuit,
      traID:   t.traID ?? '',
    });
  });
  sheet.getRow(1).font = { bold: true };
  await workbook.xlsx.writeFile(destino);
}

// Helper que cierra un remito del mock (genera PDF si tiene tramites)
async function cerrarRemitoMock(
  remito: NonNullable<ReturnType<typeof findRemitoAbierto>>
): Promise<void> {
  if (remito.tramites.length > 0) {
    const nombre   = `RTO-${remito.nroRemito}`;
    const pdfPath  = path.join(GENERATED_DIR, `${nombre}.pdf`);
    const xlsxPath = path.join(GENERATED_DIR, `${nombre}.xlsx`);
    await generarPdfRemito(remito.nroRemito, remito.tramites, pdfPath);
    await generarExcelRemito(remito.tramites, xlsxPath);
    remito.pdfUrl   = `/files/${nombre}.pdf`;
    remito.excelUrl = `/files/${nombre}.xlsx`;
  }
  remito.estado = 'cerrado';
}

// ---------------------------------------------------------------------------
// GET /api/remitos
// ---------------------------------------------------------------------------
router.get('/', async (_req, res) => {
  if (MOCKS) {
    return res.json({ remitos: remitosStore });
  }
  try {
    const remitos = await dbListarRemitos();
    res.json({ remitos });
  } catch (err) {
    console.error('[GET /remitos]', err);
    res.status(500).json({ error: 'Error al obtener remitos' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/remitos/activo — devuelve el remito abierto o null
// ---------------------------------------------------------------------------
router.get('/activo', async (_req, res) => {
  if (MOCKS) {
    return res.json({ activo: findRemitoAbierto() ?? null });
  }
  try {
    const activo = await dbGetRemitoAbierto();
    res.json({ activo });
  } catch (err) {
    console.error('[GET /remitos/activo]', err);
    res.status(500).json({ error: 'Error al obtener el remito activo' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/remitos — abrir un nuevo remito vacío (cierra el activo si hay uno)
// ---------------------------------------------------------------------------
router.post('/', async (_req, res) => {
  if (MOCKS) {
    const abierto = findRemitoAbierto();
    if (abierto) await cerrarRemitoMock(abierto);

    const { id, nroRemito } = nextRemitoNumero();
    const remito = {
      id, nroRemito, tramiteIds: [], tramites: [],
      creadoEn: new Date().toISOString(),
      pdfUrl: '', excelUrl: '', estado: 'abierto' as const,
    };
    remitosStore.push(remito);
    return res.json({ remito });
  }

  try {
    const { remito, cerradoId } = await dbCrearRemitoVacio();

    // Generar PDF para el remito que se acaba de cerrar (si tenía tramites)
    if (cerradoId !== null) {
      const [previo, tramitesPrevio] = await Promise.all([
        dbGetRemitoBasic(cerradoId),
        dbGetRemitoTramites(cerradoId),
      ]);
      if (previo && tramitesPrevio.length > 0) {
        const nombre   = `RTO-${previo.nroRemito}`;
        const pdfPath  = path.join(GENERATED_DIR, `${nombre}.pdf`);
        const xlsxPath = path.join(GENERATED_DIR, `${nombre}.xlsx`);
        await generarPdfRemito(previo.nroRemito, tramitesPrevio, pdfPath);
        await generarExcelRemito(tramitesPrevio, xlsxPath);
        await dbFinalizarRemito(cerradoId, `/files/${nombre}.pdf`, `/files/${nombre}.xlsx`);
      }
    }

    res.json({ remito });
  } catch (err) {
    console.error('[POST /remitos]', err);
    res.status(500).json({ error: 'Error al crear el remito' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/remitos/:id/cerrar — cierra el remito y genera PDF/Excel
// ---------------------------------------------------------------------------
router.patch('/:id/cerrar', async (req, res) => {
  const id = Number(req.params.id);

  if (MOCKS) {
    const remito = remitosStore.find((r) => r.id === id);
    if (!remito) return res.status(404).json({ error: 'Remito no encontrado' });
    if (remito.estado === 'cerrado') return res.status(400).json({ error: 'El remito ya está cerrado' });
    await cerrarRemitoMock(remito);
    return res.json({ remito });
  }

  try {
    const basico = await dbGetRemitoBasic(id);
    if (!basico) return res.status(404).json({ error: 'Remito no encontrado' });
    if (basico.estado === 'cerrado') return res.status(400).json({ error: 'El remito ya está cerrado' });

    const tramites = await dbGetRemitoTramites(id);
    let pdfUrl = '';
    let excelUrl = '';

    if (tramites.length > 0) {
      const nombre   = `RTO-${basico.nroRemito}`;
      const pdfPath  = path.join(GENERATED_DIR, `${nombre}.pdf`);
      const xlsxPath = path.join(GENERATED_DIR, `${nombre}.xlsx`);
      await generarPdfRemito(basico.nroRemito, tramites, pdfPath);
      await generarExcelRemito(tramites, xlsxPath);
      pdfUrl   = `/files/${nombre}.pdf`;
      excelUrl = `/files/${nombre}.xlsx`;
    }

    await dbFinalizarRemito(id, pdfUrl, excelUrl);
    const remito = {
      ...basico, estado: 'cerrado' as const,
      tramiteIds: tramites.map((t) => t.id), tramites, pdfUrl, excelUrl,
    };
    res.json({ remito });
  } catch (err) {
    console.error('[PATCH /remitos/:id/cerrar]', err);
    res.status(500).json({ error: 'Error al cerrar el remito' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/remitos/:id/abrir — reabre un remito; cierra el activo si existe
// ---------------------------------------------------------------------------
router.patch('/:id/abrir', async (req, res) => {
  const id = Number(req.params.id);

  if (MOCKS) {
    const remito = remitosStore.find((r) => r.id === id);
    if (!remito) return res.status(404).json({ error: 'Remito no encontrado' });
    if (remito.estado === 'abierto') return res.status(400).json({ error: 'El remito ya está abierto' });

    const otroAbierto = findRemitoAbierto();
    if (otroAbierto) await cerrarRemitoMock(otroAbierto);
    remito.estado = 'abierto';
    return res.json({ remito });
  }

  try {
    const basico = await dbGetRemitoBasic(id);
    if (!basico) return res.status(404).json({ error: 'Remito no encontrado' });
    if (basico.estado === 'abierto') return res.status(400).json({ error: 'El remito ya está abierto' });

    const { cerradoId } = await dbAbrirRemito(id);

    // Generar PDF para el que fue cerrado al abrir este
    if (cerradoId !== null) {
      const [previo, tramitesPrevio] = await Promise.all([
        dbGetRemitoBasic(cerradoId),
        dbGetRemitoTramites(cerradoId),
      ]);
      if (previo && tramitesPrevio.length > 0) {
        const nombre   = `RTO-${previo.nroRemito}`;
        const pdfPath  = path.join(GENERATED_DIR, `${nombre}.pdf`);
        const xlsxPath = path.join(GENERATED_DIR, `${nombre}.xlsx`);
        await generarPdfRemito(previo.nroRemito, tramitesPrevio, pdfPath);
        await generarExcelRemito(tramitesPrevio, xlsxPath);
        await dbFinalizarRemito(cerradoId, `/files/${nombre}.pdf`, `/files/${nombre}.xlsx`);
      }
    }

    const tramites = await dbGetRemitoTramites(id);
    const remito = {
      ...basico, estado: 'abierto' as const,
      tramiteIds: tramites.map((t) => t.id), tramites,
    };
    res.json({ remito });
  } catch (err) {
    console.error('[PATCH /remitos/:id/abrir]', err);
    res.status(500).json({ error: 'Error al abrir el remito' });
  }
});

export default router;
