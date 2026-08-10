import type { ExcelImportRowError } from '../../../shared/types/index.js';
import type { TramiteParsed } from './excelParser.js';

// Función que resuelve qué chasis ya existen (DB real o mock store).
// Se inyecta desde la ruta para desacoplar el módulo de validaciones.
export type ChasisChecker = (nrosChasis: string[]) => Promise<string[]>;

// Retorna la fila de cada validador como tipo interno para el pipeline.
type Validator = (
  tramites: TramiteParsed[],
  opts: ValidatorOpts
) => Promise<ExcelImportRowError[]> | ExcelImportRowError[];

interface ValidatorOpts {
  chasisChecker: ChasisChecker;
}

// --- Validadores individuales ---

function validarChasisDuplicadosEnExcel(tramites: TramiteParsed[]): ExcelImportRowError[] {
  const apariciones = new Map<string, number[]>(); // chasis normalizado → [filas]
  for (const t of tramites) {
    const k = t.auto.nroChasis.trim().toUpperCase();
    if (!apariciones.has(k)) apariciones.set(k, []);
    apariciones.get(k)!.push(t._fila);
  }

  const errores: ExcelImportRowError[] = [];
  for (const t of tramites) {
    const k = t.auto.nroChasis.trim().toUpperCase();
    const filas = apariciones.get(k)!;
    if (filas.length > 1) {
      const otrasFilas = filas.filter((f) => f !== t._fila).join(', ');
      errores.push({
        fila: t._fila,
        motivo: `Chasis duplicado en el archivo (también aparece en fila ${otrasFilas})`,
        datos: {
          chasis: t.auto.nroChasis,
          titular: t.titular.nombre,
          cuit: t.titular.cuit,
        },
      });
    }
  }
  return errores;
}

async function validarChasisExistentesEnDb(
  tramites: TramiteParsed[],
  { chasisChecker }: ValidatorOpts
): Promise<ExcelImportRowError[]> {
  const nros = tramites.map((t) => t.auto.nroChasis);
  const existentes = await chasisChecker(nros);
  const existenteSet = new Set(existentes.map((c) => c.trim().toUpperCase()));

  return tramites
    .filter((t) => existenteSet.has(t.auto.nroChasis.trim().toUpperCase()))
    .map((t) => ({
      fila: t._fila,
      motivo: `El chasis ${t.auto.nroChasis} ya existe en la base de datos`,
      datos: {
        chasis: t.auto.nroChasis,
        titular: t.titular.nombre,
        cuit: t.titular.cuit,
      },
    }));
}

// --- Pipeline extensible ---
// Para agregar una nueva validación: añadir la función a este array.
const VALIDATORS: Validator[] = [
  (tramites) => validarChasisDuplicadosEnExcel(tramites),
  (tramites, opts) => validarChasisExistentesEnDb(tramites, opts),
];

export async function validarImport(
  tramites: TramiteParsed[],
  opts: ValidatorOpts
): Promise<{ validos: TramiteParsed[]; errores: ExcelImportRowError[] }> {
  const allErrors: ExcelImportRowError[] = [];

  for (const validate of VALIDATORS) {
    const errs = await validate(tramites, opts);
    allErrors.push(...errs);
  }

  const filasConError = new Set(allErrors.map((e) => e.fila));
  const validos = tramites.filter((t) => !filasConError.has(t._fila));

  return { validos, errores: allErrors };
}
