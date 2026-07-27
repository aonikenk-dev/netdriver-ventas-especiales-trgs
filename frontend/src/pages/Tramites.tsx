import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, ChevronDown,
  ListOrdered, Printer, ScrollText, Send, Loader2,
} from 'lucide-react';
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
  field, children, filters, onSort,
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
        {active ? (isAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} />}
      </span>
    </TableHead>
  );
}

// Parsea "01-3082527" → { prefix: "01-", num: 3082527, width: 7 }
function parseFormNumber(s: string): { prefix: string; num: number; width: number } | null {
  const match = s.match(/^(.*?)(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], num: parseInt(match[2], 10), width: match[2].length };
}

export function Tramites() {
  const {
    tramites, loading, enviando, pagination, filters,
    fetchTramites, setPage, setFilters, importarDesdeExcel, actualizarFormulario, enviarAlWs,
    enviarARemito,
  } = useTramitesStore();

  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [searchInput, setSearchInput] = useState('');
  const [modalDocs, setModalDocs] = useState<GestorTramite | null>(null);
  const [modalLogs, setModalLogs] = useState<GestorTramite | null>(null);
  const [enviandoARemito, setEnviandoARemito] = useState<Set<number>>(new Set());
  const [enviandoLote, setEnviandoLote] = useState(false);
  const checkboxAllRef = useRef<HTMLInputElement>(null);

  // Estado controlado para los inputs de formulario (f01/f12)
  const [formValues, setFormValues] = useState<Map<number, { f01: string; f12: string }>>(new Map());

  // Sincronizar con los tramites del store (cambio de página, importación, etc.)
  useEffect(() => {
    setFormValues(new Map(tramites.map((t) => [
      t.id,
      { f01: t.formularioNro01 ?? '', f12: t.formularioNro12 ?? '' },
    ])));
  }, [tramites]);

  useEffect(() => { fetchTramites(); }, [fetchTramites]);

  // Debounce de búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) setFilters({ search: searchInput });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const elegibles = useMemo(() => tramites.filter((t) => t.estado !== 'enviando'), [tramites]);
  const seleccionadosTramites = useMemo(() => tramites.filter((t) => seleccion.has(t.id)), [tramites, seleccion]);
  const seleccionPendiente = useMemo(() => seleccionadosTramites.filter((t) => t.estado === 'pendiente'), [seleccionadosTramites]);
  const seleccionables = useMemo(() => tramites.filter((t) => t.estado === 'pendiente'), [tramites]);
  const seleccionOkParaRemito = useMemo(
    () => seleccionadosTramites.filter((t) => t.estado === 'ok' && !t.enviadoARemito),
    [seleccionadosTramites],
  );

  const todosSeleccionados = elegibles.length > 0 && elegibles.every((t) => seleccion.has(t.id));
  const algunosSeleccionados = elegibles.some((t) => seleccion.has(t.id));

  useEffect(() => {
    if (checkboxAllRef.current) {
      checkboxAllRef.current.indeterminate = algunosSeleccionados && !todosSeleccionados;
    }
  }, [algunosSeleccionados, todosSeleccionados]);

  const toggle = (id: number) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (todosSeleccionados) {
      setSeleccion((prev) => { const n = new Set(prev); elegibles.forEach((t) => n.delete(t.id)); return n; });
    } else {
      setSeleccion((prev) => new Set([...prev, ...elegibles.map((t) => t.id)]));
    }
  };

  const setFormVal = (id: number, campo: 'f01' | 'f12', val: string) => {
    setFormValues((prev) => {
      const next = new Map(prev);
      next.set(id, { ...next.get(id) ?? { f01: '', f12: '' }, [campo]: val });
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
    const ids = seleccionPendiente.map((t) => t.id);
    if (ids.length === 0) return;
    try {
      await enviarAlWs(ids);
      toast.success('Tramites enviados a TRGS');
      setSeleccion(new Set());
    } catch {
      toast.error('Fallo la comunicacion con el WS de TRGS');
    }
  };

  const handleSort = (field: SortField) => {
    const newDir = filters.sortBy === field && filters.sortDir === 'asc' ? 'desc' : 'asc';
    setFilters({ sortBy: field, sortDir: newDir });
  };

  const handleEnviarARemito = async (id: number) => {
    setEnviandoARemito((prev) => new Set([...prev, id]));
    try {
      await enviarARemito(id);
      toast.success('Trámite enviado a remito. Ya está disponible en la pestaña Remitos.');
    } catch {
      toast.error('No se pudo enviar a remito');
    } finally {
      setEnviandoARemito((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const handleEnviarARemitoLote = async () => {
    const ids = seleccionOkParaRemito.map((t) => t.id);
    if (ids.length === 0) return;
    setEnviandoLote(true);
    try {
      await Promise.all(ids.map((id) => enviarARemito(id)));
      toast.success(`${ids.length} trámite(s) enviados a remito.`);
      setSeleccion(new Set());
    } catch {
      toast.error('No se pudieron enviar todos a remito');
    } finally {
      setEnviandoLote(false);
    }
  };

  const handleAutorellenar = async () => {
    // Buscar el primer valor de referencia (seed) para f01 y f12
    let s01: ReturnType<typeof parseFormNumber> | null = null;
    let s12: ReturnType<typeof parseFormNumber> | null = null;
    let i01 = -1;
    let i12 = -1;

    tramites.forEach((t, i) => {
      const v = formValues.get(t.id);
      if (i01 === -1 && v?.f01) { const p = parseFormNumber(v.f01); if (p) { s01 = p; i01 = i; } }
      if (i12 === -1 && v?.f12) { const p = parseFormNumber(v.f12); if (p) { s12 = p; i12 = i; } }
    });

    if (i01 === -1 && i12 === -1) {
      toast.warning('Ingresá al menos un número de formulario como base para autorellenar');
      return;
    }

    const updates = new Map(formValues);
    const toSave: Array<{ id: number; f01: string; f12: string }> = [];

    tramites.forEach((t, i) => {
      if (t.estado !== 'pendiente') return;
      const current = updates.get(t.id) ?? { f01: '', f12: '' };
      const newVals = { ...current };
      let changed = false;

      if (s01 && i > i01) {
        newVals.f01 = `${s01.prefix}${String(s01.num + (i - i01)).padStart(s01.width, '0')}`;
        changed = true;
      }
      if (s12 && i > i12) {
        newVals.f12 = `${s12.prefix}${String(s12.num + (i - i12)).padStart(s12.width, '0')}`;
        changed = true;
      }

      if (changed) {
        updates.set(t.id, newVals);
        toSave.push({ id: t.id, f01: newVals.f01, f12: newVals.f12 });
      }
    });

    setFormValues(updates);

    if (toSave.length === 0) {
      toast.warning('No hay trámites pendientes después de la fila de referencia');
      return;
    }

    await Promise.all(toSave.map(({ id, f01, f12 }) =>
      actualizarFormulario(id, { formularioNro01: f01, formularioNro12: f12 })
    ));
    toast.success(`${toSave.length} fila(s) autocompletadas`);
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
          <Button onClick={handleEnviar} disabled={seleccionPendiente.length === 0 || enviando}>
            {enviando ? 'Enviando...' : `Enviar SUATS (${seleccionPendiente.length})`}
          </Button>
          {seleccionOkParaRemito.length > 0 && (
            <Button variant="outline" size="sm" disabled={enviandoLote} onClick={handleEnviarARemitoLote}>
              {enviandoLote ? <Loader2 size={13} className="modal-docs__spinner" /> : <Send size={13} />}
              Enviar a remito ({seleccionOkParaRemito.length})
            </Button>
          )}
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
            onChange={(e) => setFilters({ estado: e.target.value as EstadoTramite | 'all' | 'enviadoARemito' })}
          >
            <option value="all">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="enviando">Enviando</option>
            <option value="ok">OK</option>
            <option value="error">Error</option>
            <option value="enviadoARemito">En remito</option>
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

          <Button variant="outline" size="sm" title="Autorellenar Forms 01 y 12" onClick={handleAutorellenar}>
            <ListOrdered size={13} />
            Autorellenar Forms
          </Button>

          <div className="tramites-filters__spacer" />
          <span className="tramites-filters__label">{pagination.total} tramite(s) total</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <input type="checkbox" className="th-check" ref={checkboxAllRef} checked={todosSeleccionados} onChange={toggleTodos} />
              </TableHead>
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
            {tramites.map((t) => {
              const fv = formValues.get(t.id) ?? { f01: '', f12: '' };
              const bloqueado = t.estado === 'ok' || t.estado === 'enviando';
              return (
                <TableRow key={t.id} className={seleccion.has(t.id) ? 'table-row--selected' : ''}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={seleccion.has(t.id)}
                      disabled={t.estado === 'enviando'}
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
                      value={fv.f01}
                      placeholder="01-..."
                      disabled={bloqueado}
                      onChange={(e) => setFormVal(t.id, 'f01', e.target.value)}
                      onBlur={() => actualizarFormulario(t.id, { formularioNro01: fv.f01 })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="data-table__num-input"
                      value={fv.f12}
                      placeholder="12-..."
                      disabled={bloqueado}
                      onChange={(e) => setFormVal(t.id, 'f12', e.target.value)}
                      onBlur={() => actualizarFormulario(t.id, { formularioNro12: fv.f12 })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="estado-badges">
                      <Badge variant={t.estado}>{ESTADO_LABEL[t.estado]}</Badge>
                      {t.enviadoARemito && <Badge variant="enviadoARemito">En remito</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="cell-mono">
                    {t.estado === 'ok' && t.traID}
                    {t.estado === 'error' && <span className="cell-error">{t.errorDesc}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="actions-cell">
                      {t.estado === 'ok' && (
                        <>
                          <Button size="sm" variant="ghost" title="Imprimir formularios" onClick={() => setModalDocs(t)}>
                            <Printer size={14} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title={t.enviadoARemito ? 'Ya enviado a remito' : 'Enviar a remito'}
                            disabled={!!t.enviadoARemito || enviandoARemito.has(t.id)}
                            onClick={() => handleEnviarARemito(t.id)}
                          >
                            {enviandoARemito.has(t.id)
                              ? <Loader2 size={14} className="modal-docs__spinner" />
                              : <Send size={14} className={t.enviadoARemito ? 'enviado-a-remito-icon--done' : ''} />}
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" title="Ver logs" onClick={() => setModalLogs(t)}>
                        <ScrollText size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
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
          <Button variant="outline" size="sm" disabled={pagination.page <= 1 || loading} onClick={() => setPage(pagination.page - 1)}>
            <ChevronLeft size={14} />
          </Button>
          <span className="pagination__info">
            Pagina {pagination.page} de {pagination.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => setPage(pagination.page + 1)}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <ModalDocumentos tramite={modalDocs} onClose={() => setModalDocs(null)} />
      <ModalLogs tramite={modalLogs} onClose={() => setModalLogs(null)} />
    </>
  );
}
