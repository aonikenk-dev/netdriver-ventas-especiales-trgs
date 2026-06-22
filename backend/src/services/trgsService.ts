// Cliente SOAP del WS TRGS. PROTOTIPO: respuestas mockeadas con latencia
// (eco -> abrir_sesion -> generar_tramite_01 -> obtener_formularios -> cerrar_sesion).
//
// Cuando se conecte el WS real, reemplazar el cuerpo de cada funcion por
// las llamadas `soap` (node-soap) contra TRGS_URL, manteniendo esta misma firma.

import type {
  GestorFormulario,
  TrgDatosTramite,
  TrgEcoRespuesta,
  TrgSesionRespuesta,
  TrgTramiteRespuesta,
} from '../../../shared/types/index.js';

const LATENCIA_MS = 350;
const PROBABILIDAD_ERROR = 0.15;

const ERRORES_SIMULADOS = [
  'rspID -14: CUIT del titular no coincide con AFIP',
  'rspID -22: Codigo de fabrica inexistente en tabla TRGS',
  'rspID -7: Sesion vencida, reintentar abrir_sesion',
];

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function eco(): Promise<TrgEcoRespuesta> {
  await esperar(LATENCIA_MS);
  return { respuestaID: 1, rspID: 1, rspDescrip: 'Servidor TRGS disponible (mock)' };
}

export async function abrirSesion(uswID: string): Promise<TrgSesionRespuesta> {
  await esperar(LATENCIA_MS);
  return { ingID: `ING-${uswID}-${Date.now()}`, rspID: 1, rspDescrip: 'Sesion abierta (mock)' };
}

export async function generarTramite01(
  ingID: string,
  datos: TrgDatosTramite
): Promise<TrgTramiteRespuesta> {
  await esperar(LATENCIA_MS * 2);

  const falla = Math.random() < PROBABILIDAD_ERROR;
  if (falla) {
    const motivo = ERRORES_SIMULADOS[Math.floor(Math.random() * ERRORES_SIMULADOS.length)];
    return { traID: '', rspID: -1, rspDescrip: motivo };
  }

  const traID = `TRA-${Math.floor(100000 + Math.random() * 899999)}`;
  void ingID;
  void datos;
  return { traID, rspID: 1, rspDescrip: 'Tramite generado correctamente (mock)' };
}

export async function obtenerFormularios(
  traID: string,
  tipos: GestorFormulario['tipo'][]
): Promise<GestorFormulario[]> {
  await esperar(LATENCIA_MS);
  return tipos.map((tipo, i) => ({
    id: i,
    idTramite: 0,
    tipo,
    numero: `${tipo}-${traID}`,
    pdfBase64: Buffer.from(`PDF MOCK ${tipo} ${traID}`).toString('base64'),
  }));
}

export async function cerrarSesion(ingID: string): Promise<void> {
  await esperar(LATENCIA_MS / 2);
  void ingID;
}
