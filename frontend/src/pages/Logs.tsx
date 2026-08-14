import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Eye,
  Trash2,
} from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModalErrorExcel } from '@/components/ModalErrorExcel';
import { useTramitesStore } from '@/store/useTramitesStore';
import type { ExcelImportRowError } from '@shared/types';

type SortFieldExcel = 'fila' | 'chasis' | 'titular' | 'cuit' | 'motivo';

function SortableTh<F extends string>({
  field,
  children,
  sortBy,
  sortDir,
  onSort,
}: {
  field: F;
  children: React.ReactNode;
  sortBy: F;
  sortDir: 'asc' | 'desc';
  onSort: (f: F) => void;
}) {
  const active = sortBy === field;
  return (
    <TableHead
      className={`sortable-th${active ? ' sortable-th--active' : ''}`}
      onClick={() => onSort(field)}
    >
      <span className="sortable-th__inner">
        {children}
        {active ? (
          sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
        ) : (
          <ChevronsUpDown size={11} />
        )}
      </span>
    </TableHead>
  );
}

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

// ---------------------------------------------------------------------------
// Sección Excel
// ---------------------------------------------------------------------------
function SeccionExcel() {
  const erroresExcel = useTramitesStore((s) => s.erroresExcel);
  const limpiarErroresExcel = useTramitesStore((s) => s.limpiarErroresExcel);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortFieldExcel>('fila');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [modalError, setModalError] = useState<ExcelImportRowError | null>(null);

  const handleSort = (field: SortFieldExcel) => {
    if (sortBy === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(field); setSortDir('asc'); }
  };

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    let lista = q
      ? erroresExcel.filter(
          (e) =>
            e.motivo.toLowerCase().includes(q) ||
            (e.datos?.chasis ?? '').toLowerCase().includes(q) ||
            (e.datos?.titular ?? '').toLowerCase().includes(q) ||
            (e.datos?.cuit ?? '').toLowerCase().includes(q)
        )
      : [...erroresExcel];

    lista.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'fila':    cmp = a.fila - b.fila; break;
        case 'chasis':  cmp = (a.datos?.chasis ?? '').localeCompare(b.datos?.chasis ?? ''); break;
        case 'titular': cmp = (a.datos?.titular ?? '').localeCompare(b.datos?.titular ?? ''); break;
        case 'cuit':    cmp = (a.datos?.cuit ?? '').localeCompare(b.datos?.cuit ?? ''); break;
        case 'motivo':  cmp = a.motivo.localeCompare(b.motivo); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return lista;
  }, [erroresExcel, search, sortBy, sortDir]);

  return (
    <div className="logs-section">
      <div className="logs-section__header">
        <div>
          <h2 className="logs-section__title">Importación Excel</h2>
          <p className="logs-section__desc">
            Filas omitidas en la última importación por datos inválidos o incompletos.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={erroresExcel.length === 0}
          onClick={limpiarErroresExcel}
        >
          <Trash2 size={14} />
          Limpiar
        </Button>
      </div>

      <div className="tramites-filters">
        <div className="tramites-filters__search">
          <Input
            placeholder="Buscar chasis, titular, CUIT o motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tramites-filters__spacer" />
        <span className="tramites-filters__label">
          {erroresExcel.length} error(es)
          {search && filtrados.length !== erroresExcel.length && ` · ${filtrados.length} visibles`}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <SortableTh field="fila" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>Fila</SortableTh>
            <SortableTh field="chasis" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>Chasis</SortableTh>
            <SortableTh field="titular" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>Titular</SortableTh>
            <SortableTh field="cuit" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>CUIT</SortableTh>
            <SortableTh field="motivo" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>Motivo</SortableTh>
            <TableHead>Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((e, i) => (
            <TableRow key={i}>
              <TableCell className="cell-mono">{e.fila}</TableCell>
              <TableCell className="data-table__chasis">{e.datos?.chasis ?? '—'}</TableCell>
              <TableCell>{e.datos?.titular ?? '—'}</TableCell>
              <TableCell className="cell-mono">{e.datos?.cuit ?? '—'}</TableCell>
              <TableCell><span className="cell-error">{e.motivo}</span></TableCell>
              <TableCell>
                <div className="actions-cell">
                  <Button size="sm" variant="ghost" title="Ver detalle" onClick={() => setModalError(e)}>
                    <Eye size={14} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filtrados.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="table-empty">
                {erroresExcel.length === 0
                  ? 'Sin errores. Los errores de parseo aparecen aquí cuando se importa un Excel con filas inválidas.'
                  : 'Sin errores que coincidan con la búsqueda.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ModalErrorExcel error={modalError} onClose={() => setModalError(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sección Facturas
// ---------------------------------------------------------------------------
function SeccionFacturas() {
  const erroresFacturas = useTramitesStore((s) => s.erroresFacturas);
  const limpiarErroresFacturas = useTramitesStore((s) => s.limpiarErroresFacturas);

  const [search, setSearch] = useState('');

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? erroresFacturas.filter((e) => e.motivo.toLowerCase().includes(q))
      : erroresFacturas;
  }, [erroresFacturas, search]);

  return (
    <div className="logs-section">
      <div className="logs-section__header">
        <div>
          <h2 className="logs-section__title">Carga de Facturas</h2>
          <p className="logs-section__desc">
            Páginas de PDF que no pudieron procesarse o cuyo número de factura no fue reconocido.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={erroresFacturas.length === 0}
          onClick={limpiarErroresFacturas}
        >
          <Trash2 size={14} />
          Limpiar
        </Button>
      </div>

      <div className="tramites-filters">
        <div className="tramites-filters__search">
          <Input
            placeholder="Buscar motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tramites-filters__spacer" />
        <span className="tramites-filters__label">
          {erroresFacturas.length} error(es)
          {search && filtrados.length !== erroresFacturas.length && ` · ${filtrados.length} visibles`}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Página</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((e, i) => (
            <TableRow key={i}>
              <TableCell className="cell-mono">{e.pagina}</TableCell>
              <TableCell><span className="cell-error">{e.motivo}</span></TableCell>
              <TableCell className="cell-mono">{formatTs(e.cargadoEn)}</TableCell>
            </TableRow>
          ))}
          {filtrados.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="table-empty">
                {erroresFacturas.length === 0
                  ? 'Sin errores. Los errores de carga de facturas aparecen aquí.'
                  : 'Sin errores que coincidan con la búsqueda.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sección Certificados
// ---------------------------------------------------------------------------
function SeccionCertificados() {
  const erroresCertificados = useTramitesStore((s) => s.erroresCertificados);
  const limpiarErroresCertificados = useTramitesStore((s) => s.limpiarErroresCertificados);

  const [search, setSearch] = useState('');

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? erroresCertificados.filter(
          (e) => e.motivo.toLowerCase().includes(q) || e.archivo.toLowerCase().includes(q)
        )
      : erroresCertificados;
  }, [erroresCertificados, search]);

  return (
    <div className="logs-section">
      <div className="logs-section__header">
        <div>
          <h2 className="logs-section__title">Carga de Certificados</h2>
          <p className="logs-section__desc">
            Archivos del ZIP que no pudieron extraerse o guardarse en el directorio destino.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={erroresCertificados.length === 0}
          onClick={limpiarErroresCertificados}
        >
          <Trash2 size={14} />
          Limpiar
        </Button>
      </div>

      <div className="tramites-filters">
        <div className="tramites-filters__search">
          <Input
            placeholder="Buscar archivo o motivo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="tramites-filters__spacer" />
        <span className="tramites-filters__label">
          {erroresCertificados.length} error(es)
          {search && filtrados.length !== erroresCertificados.length && ` · ${filtrados.length} visibles`}
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Archivo</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Fecha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((e, i) => (
            <TableRow key={i}>
              <TableCell className="cell-mono">{e.archivo}</TableCell>
              <TableCell><span className="cell-error">{e.motivo}</span></TableCell>
              <TableCell className="cell-mono">{formatTs(e.cargadoEn)}</TableCell>
            </TableRow>
          ))}
          {filtrados.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="table-empty">
                {erroresCertificados.length === 0
                  ? 'Sin errores. Los errores de extracción de certificados aparecen aquí.'
                  : 'Sin errores que coincidan con la búsqueda.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export function Logs() {
  return (
    <>
      <Topbar title="Logs" />
      <div className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Registros del sistema</h1>
            <p className="page-header__subtitle">
              Errores de importación Excel, carga de facturas y extracción de certificados.
            </p>
          </div>
        </div>

        <SeccionExcel />
        <SeccionFacturas />
        <SeccionCertificados />
      </div>
    </>
  );
}
