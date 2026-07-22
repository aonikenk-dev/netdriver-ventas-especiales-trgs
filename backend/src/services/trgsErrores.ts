// Tabla de códigos de error TRGS con traducciones amigables (tabla NetDriver).
// Si el rspID está en esta tabla, se muestra el mensaje de NetDriver;
// si no, se muestra directamente el rspDescrip devuelto por TRGS.

interface ErrorEntry {
  mensaje: string;
  accion: string;
}

const TRGS_ERRORES: Record<number, ErrorEntry> = {
  [-1]: {
    mensaje: 'Error general del servidor TRGS',
    accion: 'Contacte al soporte de TRGS',
  },
  [-7]: {
    mensaje: 'Sesión vencida o inválida',
    accion: 'El sistema reintentará en el próximo envío; si persiste, contacte a TRGS',
  },
  [-14]: {
    mensaje: 'El CUIT del titular no coincide con los datos registrados en AFIP',
    accion: 'Verificar el CUIT en la columna O del Excel',
  },
  [-22]: {
    mensaje: 'El código de fábrica no existe en la base de datos de TRGS',
    accion: 'Revisar las columnas J, K y L del Excel (codFabrica)',
  },
  [-30]: {
    mensaje: 'El número de chasis ya tiene un trámite registrado en TRGS',
    accion: 'Verificar si el vehículo ya posee un trámite anterior',
  },
  [-31]: {
    mensaje: 'Datos del vehículo incompletos o inválidos',
    accion: 'Revisar los campos obligatorios del Excel',
  },
  [-42]: {
    mensaje: 'El número de formulario 01 es inválido o ya fue utilizado',
    accion: 'Ingresar un número de formulario 01 diferente',
  },
  [-43]: {
    mensaje: 'El número de formulario 12 es inválido o ya fue utilizado',
    accion: 'Ingresar un número de formulario 12 diferente',
  },
  [-99]: {
    mensaje: 'Error interno del servidor de TRGS',
    accion: 'Reintentar más tarde o contactar soporte de TRGS',
  },
};

export function resolverMensajeError(
  rspID: number,
  rspDescrip: string
): { mensaje: string; fuenteMensaje: 'netdriver' | 'trgs'; accion?: string } {
  const entry = TRGS_ERRORES[rspID];
  if (entry) {
    return { mensaje: entry.mensaje, fuenteMensaje: 'netdriver', accion: entry.accion };
  }
  return { mensaje: rspDescrip, fuenteMensaje: 'trgs' };
}
