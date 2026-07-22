import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown, Printer, AlertCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Topbar } from '@/components/layout/Topbar';
import { UploadExcel } from '@/components/UploadExcel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModalDocumentos } from '@/components/ModalDocumentos';
import { ModalLogs } from '@/components/ModalLogs';
import { useTramitesStore } from '@/store/useTramitesStore';
import type { EstadoTramite, CodigoClase, GestorTramite } from '@shared/types';

const ESTADO_LABEL: Record<EstadoTramite, string> = {
  pendiente: 'Pendiente',
  enviando: 'Enviando...',
  ok: 'OK',
  error: 'Error',
};

const NI_LABEL: Record<CodigoClase, string> = {
  6801: 'Nacional',
  6802: 'Importado',
};

type SortField = 'creadoEn' | 'chasis' | 'titular' | 'estado';

function SortableTh({
  field,
  children,
  filters,
  onSort,
}: {
  field: SortField;
  children: React.ReactNode;
  filters: { sortBy: string; sortDir: string };
  onSort: (f: SortField) => void;
}) {
  const active = filters.sortBy === field;
  const isAsc = filters.sortDir === 'asc';
  return (
    <TableHead
      className={`sortable-th${active ? ' sortable-th--active' : ''}`}
      onClick={() => onSort(field)}
    >
      <span className="sortable-th__inner">
        {children}
        {active ? (
          isAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />
        ) : (
          <ChevronsUpDown size={11} />
        )}
      </span>
    </TableHead>
  );
}

export function Tramites() {
  const {
    tramites, loading, enviando, pagination, filters,
    fetchTramites, setPage, setFilters, importarDesdeExcel, actualizarFormulario, enviarAlWs,
  } = useTramitesStore();

  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [searchInput, setSearchInput] = useState('');
  const [modalDocs, setModalDocs] = useState<GestorTramite | null>(null);
  const [modalLogs, setModalLogs] = useState<GestorTramite | null>(null);

  useEffect(() => {
    fetchTramites();
  }, [fetchTramites]);

  // Debounce de la búsqueda — no llama al API en cada keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters({ search: searchInput });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const seleccionables = useMemo(
    () => tramites.filter((t) => t.estado === 'pendiente'),
    [tramites]
  );

  const toggle = (id: number) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async (file: File) => {
    try {
      const { creados, errores } = await importarDesdeExcel(file);
      toast.success(`Excel procesado: ${creados} tramite(s) creado(s)`, {
        description: errores > 0 ? `${errores} fila(s) con errores fueron omitidas` : undefined,
      });
      setSeleccion(new Set());
    } catch {
      toast.error('No se pudo procesar el Excel');
    }
  };

  const handleEnviar = async () => {
    if (seleccion.size === 0) return;
    try {
      await enviarAlWs([...seleccion]);
      toast.success('Tramites enviados a TRGS (mock)');
      setSeleccion(new Set());
    } catch {
      toast.error('Fallo la comunicacion con el WS de TRGS');
    }
  };

  const handleSort = (field: SortField) => {
    const newDir =
      filters.sortBy === field && filters.sortDir === 'asc' ? 'desc' : 'asc';
    setFilters({ sortBy: field, sortDir: newDir });
  };

  return (
    <>
      <Topbar title="Tramites" />
      <div className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Inscripcion de vehiculos nuevos</h1>
            <p className="page-header__subtitle">
              Carga el Excel, completa los numeros de formulario y envia a SUATS para generar el tramite registral.
            </p>
          </div>
        </div>

        <div className="section-card upload-card">
          <UploadExcel onFileSelected={handleImport} />
        </div>

        <div className="toolbar">
          <Button onClick={handleEnviar} disabled={seleccion.size === 0 || enviando}>
            {enviando ? 'Enviando...' : `Enviar SUATS (${seleccion.size})`}
          </Button>
          <span className="toolbar__hint">{seleccionables.length} pendiente(s) en esta pagina</span>
        </div>

        <div className="tramites-filters">
          <div className="tramites-filters__search">
            <Input
              placeholder="Buscar chasis, titular o traID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <span className="tramites-filters__label">Estado:</span>
          <select
            className="tramites-filters__select"
            value={filters.estado}
            onChange={(e) => setFilters({ estado: e.target.value as EstadoTramite | 'all' })}
          >
            <option value="all">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="enviando">Enviando</option>
            <option value="ok">OK</option>
            <option value="error">Error</option>
          </select>

          <span className="tramites-filters__label">N/I:</span>
          <select
            className="tramites-filters__select"
            value={filters.ni}
            onChange={(e) => setFilters({ ni: e.target.value as 'all' | '6801' | '6802' })}
          >
            <option value="all">Todos</option>
            <option value="6801">Nacional</option>
            <option value="6802">Importado</option>
          </select>

          <span className="tramites-filters__label">Por pagina:</span>
          <select
            className="tramites-filters__select"
            value={filters.pageSize}
            onChange={(e) => setFilters({ pageSize: Number(e.target.value) })}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>

          <div className="tramites-filters__spacer" />
          <span className="tramites-filters__label">{pagination.total} tramite(s) total</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <SortableTh field="chasis" filters={filters} onSort={handleSort}>Chasis</SortableTh>
              <SortableTh field="titular" filters={filters} onSort={handleSort}>Titular</SortableTh>
              <TableHead>N/I</TableHead>
              <TableHead>Form. 01</TableHead>
              <TableHead>Form. 12</TableHead>
              <SortableTh field="estado" filters={filters} onSort={handleSort}>Estado</SortableTh>
              <TableHead>traID / detalle</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tramites.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={seleccion.has(t.id)}
                    disabled={t.estado !== 'pendiente'}
                    onChange={() => toggle(t.id)}
                  />
                </TableCell>
                <TableCell className="data-table__chasis">{t.auto.nroChasis}</TableCell>
                <TableCell>{t.titular.nombre}</TableCell>
                <TableCell>
                  <Badge variant="ok">{NI_LABEL[t.auto.codigoClase]}</Badge>
                </TableCell>
                <TableCell>
                  <Input
                    className="data-table__num-input"
                    defaultValue={t.formularioNro01 ?? ''}
                    placeholder="01-..."
                    onBlur={(e) => actualizarFormulario(t.id, { formularioNro01: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="data-table__num-input"
                    defaultValue={t.formularioNro12 ?? ''}
                    placeholder="12-..."
                    onBlur={(e) => actualizarFormulario(t.id, { formularioNro12: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={t.estado}>{ESTADO_LABEL[t.estado]}</Badge>
                </TableCell>
                <TableCell className="cell-mono">
                  {t.estado === 'ok' && t.traID}
                  {t.estado === 'error' && (
                    <span className="cell-error">{t.errorDesc}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="actions-cell">
                    {t.estado === 'ok' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Imprimir formularios"
                        onClick={() => setModalDocs(t)}
                      >
                        <Printer size={14} />
                      </Button>
                    )}
                    {t.estado === 'error' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Ver log de error"
                        onClick={() => setModalLogs(t)}
                      >
                        <AlertCircle size={14} />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && tramites.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="table-empty">
                  Sin tramites que coincidan con los filtros aplicados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="pagination">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1 || loading}
            onClick={() => setPage(pagination.page - 1)}
          >
            <ChevronLeft size={14} />
          </Button>
          <span className="pagination__info">
            Pagina {pagination.page} de {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => setPage(pagination.page + 1)}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <ModalDocumentos tramite={modalDocs} onClose={() => setModalDocs(null)} />
      <ModalLogs tramite={modalLogs} onClose={() => setModalLogs(null)} />
    </>
  );
}
