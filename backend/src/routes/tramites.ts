import { Router } from 'express';
import { filterOperatorErrors } from '../services/sanitize.js';
import * as trgsService from '../services/trgsService.js';
import { findTramite, tramitesStore } from '../mocks/data.js';
import type { TrgDatosTramite } from '../../../shared/types/index.js';

const router = Router();

// GET /api/tramites
router.get('/', (_req, res) => {
  res.json({ tramites: tramitesStore });
});

// PATCH /api/tramites/:id  -> ingresar nro formulario 01 / 12 antes de enviar SUATS
router.patch('/:id', (req, res) => {
  const tramite = findTramite(Number(req.params.id));
  if (!tramite) return res.status(404).json({ error: 'Tramite no encontrado' });

  const { formularioNro01, formularioNro12 } = req.body as {
    formularioNro01?: string;
    formularioNro12?: string;
  };
  if (formularioNro01 !== undefined) tramite.formularioNro01 = formularioNro01;
  if (formularioNro12 !== undefined) tramite.formularioNro12 = formularioNro12;

  res.json({ tramite });
});

function datosTramiteDesde(titularNombre: string, cuit: string): TrgDatosTramite {
  // PROTOTIPO: datos minimos derivados del titular del Excel.
  // El formulario real de captura de domicilio/contacto se agrega en una
  // proxima iteracion (Epica 9, frontend de tramites).
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

  for (const id of ids) {
    const tramite = findTramite(id);
    if (!tramite) continue;

    tramite.estado = 'enviando';

    const uswID = process.env.TRGS_USW_ID ?? '000005';
    const { ingID } = await trgsService.abrirSesion(uswID);
    await trgsService.eco();

    try {
      const datos = filterOperatorErrors(datosTramiteDesde(tramite.titular.nombre, tramite.titular.cuit));
      const respuesta = await trgsService.generarTramite01(ingID, datos);

      if (respuesta.rspID === 1) {
        tramite.estado = 'ok';
        tramite.traID = respuesta.traID;
        tramite.errorDesc = null;

        const tipos = tramite.auto.codigoClase === 6802 ? (['F01importado', 'F12'] as const) : (['F01', 'F12'] as const);
        const formularios = await trgsService.obtenerFormularios(respuesta.traID, [...tipos]);
        tramite.formularios = formularios.map((f) => ({ ...f, idTramite: tramite.id }));
      } else {
        tramite.estado = 'error';
        tramite.traID = null;
        tramite.errorDesc = respuesta.rspDescrip;
      }
    } finally {
      await trgsService.cerrarSesion(ingID);
    }

    resultados.push(tramite);
  }

  res.json({ tramites: resultados });
});

// GET /api/tramites/:id/formulario?tipo=F01|F01importado|F12|Enmienda|DDJJ
router.get('/:id/formulario', (req, res) => {
  const tramite = findTramite(Number(req.params.id));
  if (!tramite) return res.status(404).json({ error: 'Tramite no encontrado' });

  const tipo = String(req.query.tipo ?? '');
  const formulario = tramite.formularios.find((f) => f.tipo === tipo);

  if (!formulario?.pdfBase64) {
    return res.status(404).json({ error: `Formulario ${tipo} no disponible para este tramite` });
  }

  res.json({ tipo, numero: formulario.numero, pdfBase64: formulario.pdfBase64 });
});

export default router;
