import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { filterOperatorErrors } from '../services/sanitize.js';
import * as trgsService from '../services/trgsService.js';
import { resolverMensajeError } from '../services/trgsErrores.js';
import { findTramite, tramitesStore } from '../mocks/data.js';
import {
  dbListarTramites, dbFindTramite, dbUpdateFormulario,
  dbEnviarARemito, dbSetEnviando, dbSetOk, dbSetError,
  dbInsertFormulario, dbGetFormulario,
} from '../db/tramites.js';
import type { TramiteLog, TrgDatosTramite } from '../../../shared/types/index.js';

const router = Router();
const MOCKS = process.env.USE_MOCKS !== 'false';

// GET /api/tramites  — lista paginada con filtrado y ordenamiento
router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 10)));
  const search = String(req.query.search ?? '').trim().toLowerCase();
  const estadoFiltro = String(req.query.estado ?? 'all');
  const niFiltro = String(req.query.ni ?? 'all');
  const sortBy = String(req.query.sortBy ?? 'creadoEn');
  const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';
  const enviadoARemitoFiltro = req.query.enviadoARemito;

  if (MOCKS) {
    let lista = [...tramitesStore];

    if (search) {
      lista = lista.filter(
        (t) =>
          t.auto.nroChasis.toLowerCase().includes(search) ||
          t.titular.nombre.toLowerCase().includes(search) ||
          (t.traID?.toLowerCase().includes(search) ?? false)
      );
    }
    if (estadoFiltro !== 'all') lista = lista.filter((t) => t.estado === estadoFiltro);
    if (niFiltro !== 'all') lista = lista.filter((t) => t.auto.codigoClase === Number(niFiltro));
    if (enviadoARemitoFiltro === 'true') lista = lista.filter((t) => !!t.enviadoARemito);
    else if (enviadoARemitoFiltro === 'false') lista = lista.filter((t) => !t.enviadoARemito);

    lista.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'chasis') cmp = a.auto.nroChasis.localeCompare(b.auto.nroChasis);
      else if (sortBy === 'titular') cmp = a.titular.nombre.localeCompare(b.titular.nombre);
      else if (sortBy === 'estado') cmp = a.estado.localeCompare(b.estado);
      else cmp = a.creadoEn.localeCompare(b.creadoEn);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const total = lista.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const actualPage = Math.min(page, totalPages);
    const start = (actualPage - 1) * pageSize;
    return res.json({ tramites: lista.slice(start, start + pageSize), total, page: actualPage, pageSize, totalPages });
  }

  // --- DB ---
  try {
    const result = await dbListarTramites({
      page, pageSize, search, sortDir: sortDir as 'asc' | 'desc',
      sortBy: sortBy as 'creadoEn' | 'chasis' | 'titular' | 'estado',
      estado: estadoFiltro as 'all',
      ni: niFiltro as 'all' | '6801' | '6802',
      enviadoARemito: enviadoARemitoFiltro === 'true' ? true : enviadoARemitoFiltro === 'false' ? false : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error('[GET /tramites]', err);
    res.status(500).json({ error: 'Error al consultar la base de datos' });
  }
});

// PATCH /api/tramites/:id/enviar-remito
router.patch('/:id/enviar-remito', async (req, res) => {
  const id = Number(req.params.id);

  if (MOCKS) {
    const tramite = findTramite(id);
    if (!tramite) return res.status(404).json({ error: 'Tramite no encontrado' });
    if (tramite.estado !== 'ok') return res.status(400).json({ error: 'Solo se pueden enviar a remito tramites con estado OK' });
    tramite.enviadoARemito = true;
    return res.json({ tramite });
  }

  // --- DB ---
  try {
    const tramite = await dbFindTramite(id);
    if (!tramite) return res.status(404).json({ error: 'Tramite no encontrado' });
    if (tramite.estado !== 'ok') return res.status(400).json({ error: 'Solo se pueden enviar a remito tramites con estado OK' });
    const actualizado = await dbEnviarARemito(id);
    res.json({ tramite: actualizado });
  } catch (err) {
    console.error('[PATCH /tramites/:id/enviar-remito]', err);
    res.status(500).json({ error: 'Error al actualizar el tramite' });
  }
});

// PATCH /api/tramites/:id  -> actualizar nro formulario 01 / 12
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { formularioNro01, formularioNro12 } = req.body as {
    formularioNro01?: string;
    formularioNro12?: string;
  };

  if (MOCKS) {
    const tramite = findTramite(id);
    if (!tramite) return res.status(404).json({ error: 'Tramite no encontrado' });
    if (formularioNro01 !== undefined) tramite.formularioNro01 = formularioNro01;
    if (formularioNro12 !== undefined) tramite.formularioNro12 = formularioNro12;
    return res.json({ tramite });
  }

  // --- DB ---
  try {
    const tramite = await dbFindTramite(id);
    if (!tramite) return res.status(404).json({ error: 'Tramite no encontrado' });
    const actualizado = await dbUpdateFormulario(id, { formularioNro01, formularioNro12 });
    res.json({ tramite: actualizado });
  } catch (err) {
    console.error('[PATCH /tramites/:id]', err);
    res.status(500).json({ error: 'Error al actualizar el tramite' });
  }
});

function datosTramiteDesde(titularNombre: string, cuit: string): TrgDatosTramite {
  return {
    traTelefono: '011-4000-0000',
    traCalle: 'AV SIEMPRE VIVA',
    traNumero: '742',
    traEmail: `${titularNombre.split(',')[0].trim().toLowerCase().replace(/\s+/g, '.')}@mail.com`,
    traOcupacion: 'EMPLEADO',
    traCP: '1900',
    traLugarNacimiento: 'LA PLATA',
    traDocumento: Number(cuit.slice(2, -1)) || 0,
    traCuit: Number(cuit) || 0,
  };
}

// POST /api/tramites/enviar  { ids: number[] }
router.post('/enviar', async (req, res) => {
  const { ids } = req.body as { ids: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array "ids" con al menos un tramite' });
  }

  const resultados = [];
  const now = () => new Date().toISOString();
  const uswID = process.env.TRGS_USW_ID ?? '000005';

  for (const id of ids) {
    const tramite = MOCKS ? findTramite(id) : await dbFindTramite(id).catch(() => undefined);
    if (!tramite) continue;

    if (MOCKS) tramite.estado = 'enviando';
    else await dbSetEnviando(id);

    const logs: TramiteLog[] = [];

    const ecoResp = await trgsService.eco();
    logs.push({
      timestamp: now(), nivel: 'info', operacion: 'eco',
      mensaje: ecoResp.respuestaID === 1 ? 'Servidor TRGS disponible' : 'Servidor TRGS no disponible',
      detalle: `respuestaID: ${ecoResp.respuestaID}`,
    });

    const sesionResp = await trgsService.abrirSesion(uswID);
    logs.push({
      timestamp: now(),
      nivel: sesionResp.rspID === 1 ? 'info' : 'error',
      operacion: 'abrir_sesion',
      mensaje: sesionResp.rspID === 1
        ? `Sesión abierta (${sesionResp.ingID})`
        : `Error al abrir sesión: ${sesionResp.rspDescrip}`,
      detalle: `rspID: ${sesionResp.rspID} — ${sesionResp.rspDescrip}`,
    });

    const { ingID } = sesionResp;

    try {
      const datos = filterOperatorErrors(datosTramiteDesde(tramite.titular.nombre, tramite.titular.cuit));
      const respuesta = await trgsService.generarTramite01(ingID, datos);

      if (respuesta.rspID === 1) {
        if (MOCKS) {
          tramite.estado = 'ok';
          tramite.traID = respuesta.traID;
          tramite.errorDesc = null;
        } else {
          await dbSetOk(id, respuesta.traID);
        }

        logs.push({
          timestamp: now(), nivel: 'info', operacion: 'generar_tramite_01',
          mensaje: 'Trámite generado correctamente',
          detalle: `traID: ${respuesta.traID} — ${respuesta.rspDescrip}`,
        });

        const tipos = tramite.auto.codigoClase === 6802
          ? (['F01importado', 'F12'] as const)
          : (['F01', 'F12'] as const);
        const formularios = await trgsService.obtenerFormularios(respuesta.traID, [...tipos]);

        if (MOCKS) {
          tramite.formularios = formularios.map((f) => ({ ...f, idTramite: tramite.id }));
        } else {
          for (const f of formularios) {
            await dbInsertFormulario(id, f.tipo, f.numero, f.pdfBase64);
          }
        }
      } else {
        if (MOCKS) {
          tramite.estado = 'error';
          tramite.traID = null;
          tramite.errorDesc = respuesta.rspDescrip;
        } else {
          await dbSetError(id, respuesta.rspDescrip);
        }

        const { mensaje, fuenteMensaje, accion } = resolverMensajeError(respuesta.rspID, respuesta.rspDescrip);
        logs.push({
          timestamp: now(), nivel: 'error', operacion: 'generar_tramite_01',
          mensaje,
          detalle: `rspID: ${respuesta.rspID} — ${respuesta.rspDescrip}${accion ? ` | Acción sugerida: ${accion}` : ''}`,
          fuenteMensaje,
        });
      }
    } finally {
      await trgsService.cerrarSesion(ingID);
      logs.push({ timestamp: now(), nivel: 'info', operacion: 'cerrar_sesion', mensaje: 'Sesión cerrada' });
    }

    const tramiteActualizado = MOCKS
      ? tramite
      : await dbFindTramite(id).catch(() => tramite);

    if (tramiteActualizado) {
      tramiteActualizado.logs = logs;
      resultados.push(tramiteActualizado);
    }
  }

  res.json({ tramites: resultados });
});

// GET /api/tramites/:id/bundle-imprimir
router.get('/:id/bundle-imprimir', async (req, res) => {
  const tramite = MOCKS
    ? findTramite(Number(req.params.id))
    : await dbFindTramite(Number(req.params.id)).catch(() => undefined);

  if (!tramite) return res.status(404).json({ error: 'Tramite no encontrado' });
  if (tramite.estado !== 'ok') return res.status(400).json({ error: 'El tramite no tiene estado OK' });

  const DOCS = [
    { label: 'Hoja de Enmienda', fuente: 'WS TRGS' },
    { label: 'Declaracion Jurada', fuente: 'WS TRGS' },
    { label: 'Certificado de Fabrica', fuente: 'PDF_DIR local' },
    { label: 'Factura', fuente: 'PDF_DIR local' },
  ];

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="bundle-${tramite.auto.nroChasis}.pdf"`);

  const doc = new PDFDocument({ margin: 50, autoFirstPage: false });
  doc.pipe(res);

  DOCS.forEach((d) => {
    doc.addPage();
    doc.fontSize(18).fillColor('#15181C').text(d.label, { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor('#888').text(`Fuente: ${d.fuente}`, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(11).fillColor('#15181C');
    doc.text(`Chasis:          ${tramite.auto.nroChasis}`);
    doc.text(`Marca / Modelo:  ${tramite.auto.marcaChasis} ${tramite.auto.modelo}`);
    doc.text(`Titular:         ${tramite.titular.nombre}`);
    doc.text(`CUIT:            ${tramite.titular.cuit}`);
    if (tramite.traID) doc.text(`traID:           ${tramite.traID}`);
    doc.moveDown(3);
    doc.fontSize(8).fillColor('#aaa').text(
      'Documento de muestra. En produccion este bundle concatena los PDFs reales del WS TRGS y del directorio PDF_DIR.'
    );
  });

  doc.end();
});

// GET /api/tramites/:id/formulario?tipo=F01|F01importado|F12|Enmienda|DDJJ
router.get('/:id/formulario', async (req, res) => {
  const id = Number(req.params.id);
  const tipo = String(req.query.tipo ?? '');

  if (MOCKS) {
    const tramite = findTramite(id);
    if (!tramite) return res.status(404).json({ error: 'Tramite no encontrado' });
    const formulario = tramite.formularios.find((f) => f.tipo === tipo);
    if (!formulario?.pdfBase64) {
      const pdfBase64 = Buffer.from(`PDF MOCK ${tipo} ${tramite.traID ?? 'sin-traID'}`).toString('base64');
      return res.json({ tipo, numero: `${tipo}-MOCK`, pdfBase64 });
    }
    return res.json({ tipo, numero: formulario.numero, pdfBase64: formulario.pdfBase64 });
  }

  // --- DB ---
  try {
    const tramite = await dbFindTramite(id);
    if (!tramite) return res.status(404).json({ error: 'Tramite no encontrado' });
    const formulario = await dbGetFormulario(id, tipo);
    if (!formulario?.pdfBase64) {
      const pdfBase64 = Buffer.from(`PDF MOCK ${tipo} ${tramite.traID ?? 'sin-traID'}`).toString('base64');
      return res.json({ tipo, numero: `${tipo}-MOCK`, pdfBase64 });
    }
    res.json({ tipo, numero: formulario.numero, pdfBase64: formulario.pdfBase64 });
  } catch (err) {
    console.error('[GET /tramites/:id/formulario]', err);
    res.status(500).json({ error: 'Error al obtener el formulario' });
  }
});

export default router;
