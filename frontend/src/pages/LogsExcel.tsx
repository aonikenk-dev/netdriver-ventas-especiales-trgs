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

type SortField = 'fila' | 'chasis' | 'titular' | 'cuit' | 'motivo';

function SortableTh({
  field,
  children,
  sortBy,
  sortDir,
  onSort,
}: {
  field: SortField;
  children: React.ReactNode;
  sortBy: SortField;
  sortDir: 'asc' | 'desc';
  onSort: (f: SortField) => void;
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

export function LogsExcel() {
  const erroresExcel = useTramitesStore((s) => s.erroresExcel);
  const limpiarErroresExcel = useTramitesStore((s) => s.limpiarErroresExcel);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('fila');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [modalError, setModalError] = useState<ExcelImportRowError | null>(null);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
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
    <>
      <Topbar title="Logs Excel" />
      <div className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Errores de carga de Excel</h1>
            <p className="page-header__subtitle">
              Filas omitidas en la última importación por datos inválidos o incompletos.
              Se reemplaza con cada nuevo Excel cargado.
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
            {erroresExcel.length} error(es) total
            {search && filtrados.length !== erroresExcel.length && ` · ${filtrados.length} visibles`}
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <SortableTh field="fila" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>
                Fila
              </SortableTh>
              <SortableTh field="chasis" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>
                Chasis
              </SortableTh>
              <SortableTh field="titular" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>
                Titular
              </SortableTh>
              <SortableTh field="cuit" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>
                CUIT
              </SortableTh>
              <SortableTh field="motivo" sortBy={sortBy} sortDir={sortDir} onSort={handleSort}>
                Motivo del error
              </SortableTh>
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
                <TableCell>
                  <span className="cell-error">{e.motivo}</span>
                </TableCell>
                <TableCell>
                  <div className="actions-cell">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Ver detalle"
                      onClick={() => setModalError(e)}
                    >
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
      </div>

      <ModalErrorExcel error={modalError} onClose={() => setModalError(null)} />
    </>
  );
}
