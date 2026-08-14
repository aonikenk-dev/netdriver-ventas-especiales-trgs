import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'module';
import multer from 'multer';
import { PDFDocument } from 'pdf-lib';
import { dbGetValor } from '../db/configuracion.js';

// pdf-parse y adm-zip son módulos CJS — se cargan lazy con createRequire para
// evitar problemas de ESM en el startup (createRequire es seguro en top-level)
const _require = createRequire(import.meta.url);

type PdfParseInstance = { load(buf: Buffer): Promise<void>; getText(): Promise<string> };
type PdfParseModule = { PDFParse: new (opts?: { verbosity?: number }) => PdfParseInstance };
type AdmZipEntry = { isDirectory: boolean; entryName: string; getData(): Buffer };
type AdmZipClass = new (buf: Buffer) => { getEntries(): AdmZipEntry[] };

function getPdfParseModule(): PdfParseModule {
  return _require('pdf-parse') as PdfParseModule;
}

function getAdmZip(): AdmZipClass {
  return _require('adm-zip') as AdmZipClass;
}

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const MOCKS = process.env.USE_MOCKS !== 'false';

const GENERATED_DIR = path.resolve(process.cwd(), 'generated');

function fechaHoyStr(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function resolverDirectorio(base: string, sub: string): string {
  const dir = path.join(base, sub, fechaHoyStr());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function extraerNroFactura(texto: string, regex: string): string | null {
  try {
    const match = texto.match(new RegExp(regex, 'i'));
    if (match?.[0]) return match[0].trim().replace(/\s+/g, '-');
  } catch { /* regex inválido */ }
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/upload/facturas
// Recibe un PDF multi-página; divide por página y guarda cada una con el
// número de factura extraído del texto como nombre de archivo.
// ---------------------------------------------------------------------------
router.post('/facturas', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  const facturasBase = MOCKS
    ? path.join(GENERATED_DIR, 'facturas')
    : await dbGetValor('FACTURAS_DIR');

  if (!facturasBase) return res.status(400).json({ error: 'Directorio de facturas no configurado (ver Configuración)' });

  const regexPattern = MOCKS
    ? String.raw`F[-\s]?\d{2,8}`
    : (await dbGetValor('FACTURA_NRO_REGEX')) || String.raw`F[-\s]?\d{2,8}`;

  const outputDir = resolverDirectorio(facturasBase, '');

  try {
    const srcDoc = await PDFDocument.load(req.file.buffer);
    const pageCount = srcDoc.getPageCount();

    const resultados: { pagina: number; facturaNro: string; fileName: string }[] = [];
    const errores: { pagina: number; motivo: string }[] = [];

    for (let i = 0; i < pageCount; i++) {
      try {
        // Crear un doc de una sola página
        const singleDoc = await PDFDocument.create();
        const [page] = await singleDoc.copyPages(srcDoc, [i]);
        singleDoc.addPage(page);
        const pageBytes = await singleDoc.save();

        // Extraer texto para obtener el número de factura
        let facturaNro: string;
        try {
          const { PDFParse } = getPdfParseModule();
          const parser = new PDFParse({ verbosity: 0 });
          await parser.load(Buffer.from(pageBytes));
          const text = await parser.getText();
          facturaNro = extraerNroFactura(text, regexPattern) ?? `pagina-${i + 1}`;
        } catch {
          facturaNro = `pagina-${i + 1}`;
        }

        const fileName = `${facturaNro}.pdf`;
        fs.writeFileSync(path.join(outputDir, fileName), Buffer.from(pageBytes));
        resultados.push({ pagina: i + 1, facturaNro, fileName });
      } catch (err) {
        errores.push({ pagina: i + 1, motivo: err instanceof Error ? err.message : String(err) });
      }
    }

    res.json({ total: pageCount, resultados, errores, directorio: outputDir });
  } catch (err) {
    console.error('[POST /upload/facturas]', err);
    res.status(500).json({ error: 'Error al procesar el PDF de facturas' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/upload/certificados
// Recibe un ZIP; extrae todos los archivos y los guarda en el directorio
// configurado bajo una subcarpeta con la fecha de hoy.
// ---------------------------------------------------------------------------
router.post('/certificados', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  const certBase = MOCKS
    ? path.join(GENERATED_DIR, 'certificados')
    : await dbGetValor('CERTIFICADOS_DIR');

  if (!certBase) return res.status(400).json({ error: 'Directorio de certificados no configurado (ver Configuración)' });

  const outputDir = resolverDirectorio(certBase, '');

  try {
    const AdmZip = getAdmZip();
    const zip = new AdmZip(req.file.buffer);
    const entries = zip.getEntries();

    const guardados: string[] = [];
    const errores: { archivo: string; motivo: string }[] = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      try {
        const data = entry.getData();
        // Usar solo el nombre base del archivo (ignorar directorios dentro del ZIP)
        const fileName = path.basename(entry.entryName);
        fs.writeFileSync(path.join(outputDir, fileName), data);
        guardados.push(fileName);
      } catch (err) {
        errores.push({ archivo: entry.entryName, motivo: err instanceof Error ? err.message : String(err) });
      }
    }

    res.json({ total: guardados.length, guardados, errores, directorio: outputDir });
  } catch (err) {
    console.error('[POST /upload/certificados]', err);
    res.status(500).json({ error: 'Error al procesar el ZIP de certificados' });
  }
});

export default router;
