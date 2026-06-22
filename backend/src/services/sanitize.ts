// Migrado de filterOperatorErrors() (PHP legacy). Aplicar siempre antes de

import type { TrgCedula, TrgDatosTramite } from '../../../shared/types/index.js';

const ACENTOS: Record<string, string> = {
  á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n',
  Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U', Ñ: 'N',
};

export function replaceAcentos(valor: string): string {
  return valor.replace(/[áéíóúñÁÉÍÓÚÑ]/g, (c) => ACENTOS[c] ?? c);
}

const soloNumeros = (v: string) => v.replace(/[^0-9]/g, '');
const alfanumericoEspacios = (v: string) => v.replace(/[^0-9a-zA-Z ]/g, '');
const soloLetrasEspacios = (v: string) => v.replace(/[^a-zA-Z ]/g, '');

function sanitizeNumero(valor: string): string {
  const limpio = valor.trim();
  if (/^sn$/i.test(limpio)) return limpio.toUpperCase();
  return soloNumeros(limpio);
}

function sanitizeEmail(valor: string): string {
  return valor
    .trim()
    .replace(/[áéíóúñ?]/gi, '')
    .replace(/\s/g, '');
}

function sanitizeCedula(cedula: TrgCedula): TrgCedula {
  return {
    traDocumento: soloNumeros(cedula.traDocumento),
    traNombre: soloLetrasEspacios(replaceAcentos(cedula.traNombre)),
  };
}

export function filterOperatorErrors(datos: TrgDatosTramite): TrgDatosTramite {
  const resultado: TrgDatosTramite = { ...datos };

  resultado.traTelefono = soloNumeros(resultado.traTelefono);
  resultado.traCalle = alfanumericoEspacios(resultado.traCalle);
  resultado.traNumero = sanitizeNumero(resultado.traNumero);
  if (resultado.traCalle_R !== undefined) resultado.traCalle_R = alfanumericoEspacios(resultado.traCalle_R);
  if (resultado.traNumero_R !== undefined) resultado.traNumero_R = sanitizeNumero(resultado.traNumero_R);
  resultado.traEmail = sanitizeEmail(resultado.traEmail);
  resultado.traOcupacion = soloLetrasEspacios(resultado.traOcupacion);
  resultado.traCP = soloNumeros(resultado.traCP);
  if (resultado.traCP_R !== undefined) resultado.traCP_R = soloNumeros(resultado.traCP_R);
  resultado.traLugarNacimiento = alfanumericoEspacios(resultado.traLugarNacimiento);
  if (resultado.traDocumento_C !== undefined) resultado.traDocumento_C = soloNumeros(resultado.traDocumento_C);
  resultado.traCuit = parseFloat(String(resultado.traCuit));
  resultado.traDocumento = parseFloat(String(resultado.traDocumento));
  if (resultado.traCuitTitular !== undefined) {
    resultado.traCuitTitular = parseFloat(String(resultado.traCuitTitular));
  }

  if (resultado.apoDocumento !== undefined) {
    if (resultado.apoTelefono !== undefined) resultado.apoTelefono = soloNumeros(resultado.apoTelefono);
    if (resultado.apoCalle !== undefined) resultado.apoCalle = alfanumericoEspacios(resultado.apoCalle);
    if (resultado.apoNumero !== undefined) resultado.apoNumero = sanitizeNumero(resultado.apoNumero);
    if (resultado.apoEmail !== undefined) resultado.apoEmail = sanitizeEmail(resultado.apoEmail);
    if (resultado.apoOcupacion !== undefined) resultado.apoOcupacion = soloLetrasEspacios(resultado.apoOcupacion);
    if (resultado.apoCP !== undefined) resultado.apoCP = soloNumeros(resultado.apoCP);
    if (resultado.apoLugarNacimiento !== undefined) {
      resultado.apoLugarNacimiento = alfanumericoEspacios(resultado.apoLugarNacimiento);
    }
    resultado.apoDocumento = parseFloat(String(resultado.apoDocumento));
    if (resultado.apoCuit !== undefined) {
      const limpio = String(resultado.apoCuit).replace(/[^0-9\-]/g, '');
      resultado.apoCuit = parseFloat(limpio);
    }
  }

  if (resultado.traCedulas !== undefined) {
    resultado.traCedulas = Array.isArray(resultado.traCedulas)
      ? resultado.traCedulas.map(sanitizeCedula)
      : sanitizeCedula(resultado.traCedulas);
  }

  return resultado;
}
