import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileCheck, LayoutGrid, Loader2, Printer, Table2 } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/api/client';
import { listarTramites } from '@/api/tramites';
import { useTramitesStore } from '@/store/useTramitesStore';
import type { GestorTramite, TipoFormularioDescarga } from '@shared/types';

type ViewMode = 'grid' | 'table';

const NI_LABEL: Record<number, string> = { 6801: 'Nacional', 6802: 'Importado' };
const PAGE_SIZES: Record<ViewMode, number[]> = { grid: [6, 12, 24], table: [5, 10, 20] };

function base64ToBlob(b64: string): Blob {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: 'application/pdf' });
}

function imprimirBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, '_blank');
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 60000);
  };
}

export function PDFs() {
  const marcarImpresoStore = useTramitesStore((s) => s.marcarImpreso);

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [tramites, setTramites] = useState<GestorTramite[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [cargando, setCargando] = useState<Set<string>>(new Set());
  const [marcandoImpreso, setMarcandoImpreso] = useState<Set<number>>(new Set());
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [marcandoLote, setMarcandoLote] = useState(false);
  const checkboxAllRef = useRef<HTMLInputElement>(null);

  const setKey = (key: string, on: boolean) =>
    setCargando((prev) => {
      const s = new Set(prev);
      on ? s.add(key) : s.delete(key);
      return s;
    });

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listarTramites({ estado: 'ok', page, pageSize });
      setTramites(r.tramites);
      setTotal(r.total);
      setTotalPages(r.totalPages);
      // Limpiar selección de tramites que ya no están en la página
      setSeleccion((prev) => {
        const ids = new Set(r.tramites.map((t) => t.id));
        return new Set([...prev].filter((id) => ids.has(id)));
      });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => { cargar(); }, [cargar]);

  const todosSeleccionados = tramites.length > 0 && tramites.every((t) => seleccion.has(t.id));
  const algunosSeleccionados = tramites.some((t) => seleccion.has(t.id));
  const seleccionNoImpreso = tramites.filter((t) => seleccion.has(t.id) && !t.impreso);

  useEffect(() => {
    if (checkboxAllRef.current) {
      checkboxAllRef.current.indeterminate = algunosSeleccionados && !todosSeleccionados;
    }
  }, [algunosSeleccionados, todosSeleccionados]);

  const toggleDoc = (id: number) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (todosSeleccionados) {
      setSeleccion(new Set());
    } else {
      setSeleccion(new Set(tramites.map((t) => t.id)));
    }
  };

  const cambiarVista = (mode: ViewMode) => {
    setViewMode(mode);
    setPageSize(mode === 'grid' ? 12 : 10);
    setPage(1);
    setSeleccion(new Set());
  };

  const imprimirWsDoc = async (tramiteId: number, tipo: TipoFormularioDescarga) => {
    const key = `${tramiteId}-${tipo}`;
    setKey(key, true);
    try {
      const { data } = await apiClient.get<{ pdfBase64: string }>(
        `/api/tramites/${tramiteId}/formulario`,
        { params: { tipo } }
      );
      imprimirBlob(base64ToBlob(data.pdfBase64));
    } catch {
      toast.error(`No se pudo imprimir ${tipo}`);
    } finally {
      setKey(key, false);
    }
  };

  const imprimirLocalDoc = async (
    tramiteId: number,
    tipo: 'factura' | 'certificado',
    chasis: string
  ) => {
    const key = `${tramiteId}-${tipo}`;
    setKey(key, true);
    try {
      const r = await apiClient.get(`/api/pdfs/${tipo}/${chasis}`, { responseType: 'blob' });
      imprimirBlob(r.data as Blob);
    } catch {
      toast.error(`No se pudo imprimir ${tipo}`);
    } finally {
      setKey(key, false);
    }
  };

  const imprimirBundle = async (tramiteId: number) => {
    const key = `${tramiteId}-bundle`;
    setKey(key, true);
    try {
      const r = await apiClient.get(`/api/tramites/${tramiteId}/bundle-imprimir`, {
        responseType: 'blob',
      });
      imprimirBlob(r.data as Blob);
    } catch {
      toast.error('No se pudo generar el bundle de impresión');
    } finally {
      setKey(key, false);
    }
  };

  const handleMarcarImpreso = async (id: number) => {
    setMarcandoImpreso((prev) => new Set([...prev, id]));
    try {
      await marcarImpresoStore(id);
      setTramites((prev) => prev.map((t) => (t.id === id ? { ...t, impreso: true } : t)));
      toast.success('Trámite marcado como impreso. Ya está disponible en Remitos.');
    } catch {
      toast.error('No se pudo marcar como impreso');
    } finally {
      setMarcandoImpreso((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  };

  const handleMarcarImpresoLote = async () => {
    const ids = seleccionNoImpreso.map((t) => t.id);
    if (ids.length === 0) return;
    setMarcandoLote(true);
    try {
      await Promise.all(ids.map((id) => marcarImpresoStore(id)));
      setTramites((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, impreso: true } : t));
      toast.success(`${ids.length} trámite(s) marcados como impresos. Ya están disponibles en Remitos.`);
      setSeleccion(new Set());
    } catch {
      toast.error('No se pudieron marcar todos como impresos');
    } finally {
      setMarcandoLote(false);
    }
  };

  const emptyMsg = 'Todavía no hay trámites con estado OK para mostrar documentos.';

  return (
    <>
      <Topbar title="Documentos" />
      <div className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Visor de documentos</h1>
            <p className="page-header__subtitle">
              Formularios del WS TRGS y archivos locales (factura / certificado) por trámite aprobado.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="docs-toolbar">
          {seleccion.size > 0 && seleccionNoImpreso.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={marcandoLote}
              onClick={handleMarcarImpresoLote}
            >
              {marcandoLote
                ? <Loader2 size={13} className="modal-docs__spinner" />
                : <FileCheck size={13} />}
              Marcar impresos ({seleccionNoImpreso.length})
            </Button>
          )}
          <span className="tramites-filters__label">{total} trámite(s)</span>
          <div className="tramites-filters__spacer" />
          <span className="tramites-filters__label">Por página:</span>
          <select
            className="tramites-filters__select"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
          >
            {PAGE_SIZES[viewMode].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <div className="docs-view-switch">
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              title="Vista tabla"
              onClick={() => cambiarVista('table')}
            >
              <Table2 size={14} />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              title="Vista tarjetas"
              onClick={() => cambiarVista('grid')}
            >
              <LayoutGrid size={14} />
            </Button>
          </div>
        </div>

        {/* --- Grid view --- */}
        {viewMode === 'grid' && (
          <div className="doc-grid">
            {tramites.map((t) => {
              const tipoF01: TipoFormularioDescarga =
                t.auto.codigoClase === 6802 ? 'F01importado' : 'F01';
              const busy = (tipo: string) => cargando.has(`${t.id}-${tipo}`);

              return (
                <div key={t.id} className={`doc-card${seleccion.has(t.id) ? ' doc-card--selected' : ''}`}>
                  <div className="doc-card__header">
                    <input
                      type="checkbox"
                      className="doc-card__check"
                      checked={seleccion.has(t.id)}
                      onChange={() => toggleDoc(t.id)}
                    />
                    <div className="doc-card__info">
                      <span className="doc-card__title">
                        {t.auto.nroChasis}
                      </span>
                      <span className="doc-card__meta">{t.auto.marcaChasis} {t.auto.modelo}</span>
                    </div>
                    {/* <Badge variant="ok">{NI_LABEL[t.auto.codigoClase]}</Badge> */}
                  </div>

                  <div className="doc-card__actions-row">
                    <Button
                      size="sm"
                      disabled={busy('bundle')}
                      onClick={() => imprimirBundle(t.id)}
                    >
                      {busy('bundle')
                        ? <Loader2 size={13} className="modal-docs__spinner" />
                        : <Printer size={13} />}
                      Imprimir todos
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!t.impreso || marcandoImpreso.has(t.id)}
                      title={t.impreso ? 'Ya marcado como impreso' : 'Marcar como impreso'}
                      onClick={() => !t.impreso && handleMarcarImpreso(t.id)}
                    >
                      {marcandoImpreso.has(t.id)
                        ? <Loader2 size={13} className="modal-docs__spinner" />
                        : <FileCheck size={13} className={t.impreso ? 'impreso-icon--done' : ''} />}
                      {t.impreso ? 'Ya impreso' : 'Marcar impreso'}
                    </Button>
                  </div>

                  <div className="doc-card__docs">
                    <p className="doc-card__docs-label">WS TRGS</p>
                    {(
                      [
                        [tipoF01, tipoF01 === 'F01importado' ? 'Form. 01 (importado)' : 'Formulario 01'],
                        ['F12',      'Formulario 12'],
                        ['Enmienda', 'Enmienda'],
                        ['DDJJ',     'Decl. Jurada'],
                      ] as const
                    ).map(([tipo, label]) => (
                      <div key={tipo} className="doc-card__doc-row">
                        <span className="doc-card__doc-label">{label}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          title={`Imprimir ${label}`}
                          disabled={busy(tipo)}
                          onClick={() => imprimirWsDoc(t.id, tipo as TipoFormularioDescarga)}
                        >
                          {busy(tipo)
                            ? <Loader2 size={12} className="modal-docs__spinner" />
                            : <Printer size={12} />}
                        </Button>
                      </div>
                    ))}

                    <p className="doc-card__docs-label doc-card__docs-label--mt">Archivos locales</p>
                    {(
                      [
                        ['certificado', 'Certificado de Fábrica'],
                        ['factura',     'Factura'],
                      ] as const
                    ).map(([tipo, label]) => (
                      <div key={tipo} className="doc-card__doc-row">
                        <span className="doc-card__doc-label">{label}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          title={`Imprimir ${label}`}
                          disabled={busy(tipo)}
                          onClick={() => imprimirLocalDoc(t.id, tipo, t.auto.nroChasis)}
                        >
                          {busy(tipo)
                            ? <Loader2 size={12} className="modal-docs__spinner" />
                            : <Printer size={12} />}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {tramites.length === 0 && !loading && (
              <div className="table-empty">{emptyMsg}</div>
            )}
          </div>
        )}

        {/* --- Table view --- */}
        {viewMode === 'table' && (
          <div className="docs-table-wrapper">
            <Table className="docs-table">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      className="th-check"
                      ref={checkboxAllRef}
                      checked={todosSeleccionados}
                      onChange={toggleTodos}
                    />
                  </TableHead>
                  <TableHead>Chasis</TableHead>
                  <TableHead>Marca / Modelo</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>N/I</TableHead>
                  <TableHead className="doc-th--icon" title="Formulario 01">F01</TableHead>
                  <TableHead className="doc-th--icon" title="Formulario 12">F12</TableHead>
                  <TableHead className="doc-th--icon" title="Hoja de Enmienda">Enm.</TableHead>
                  <TableHead className="doc-th--icon" title="Declaración Jurada">DDJJ</TableHead>
                  <TableHead className="doc-th--icon" title="Certificado de Fábrica">Cert.</TableHead>
                  <TableHead className="doc-th--icon" title="Factura">Fact.</TableHead>
                  <TableHead>Todos</TableHead>
                  <TableHead className="doc-th--icon" title="Marcar como impreso">Imp.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tramites.map((t) => {
                  const tipoF01: TipoFormularioDescarga =
                    t.auto.codigoClase === 6802 ? 'F01importado' : 'F01';
                  const busy = (tipo: string) => cargando.has(`${t.id}-${tipo}`);
                  const iconPrint = (tipo: string, onClick: () => void) => (
                    <Button
                      size="sm"
                      variant="ghost"
                      title={`Imprimir ${tipo}`}
                      disabled={busy(tipo)}
                      onClick={onClick}
                    >
                      {busy(tipo)
                        ? <Loader2 size={13} className="modal-docs__spinner" />
                        : <Printer size={13} />}
                    </Button>
                  );
                  return (
                    <TableRow key={t.id} className={seleccion.has(t.id) ? 'table-row--selected' : ''}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={seleccion.has(t.id)}
                          onChange={() => toggleDoc(t.id)}
                        />
                      </TableCell>
                      <TableCell className="data-table__chasis">{t.auto.nroChasis}</TableCell>
                      <TableCell>{t.auto.marcaChasis} {t.auto.modelo}</TableCell>
                      <TableCell>{t.titular.nombre}</TableCell>
                      <TableCell>
                        <Badge variant="ok">{NI_LABEL[t.auto.codigoClase]}</Badge>
                      </TableCell>
                      <TableCell className="doc-th--icon">
                        {iconPrint(tipoF01, () => imprimirWsDoc(t.id, tipoF01))}
                      </TableCell>
                      <TableCell className="doc-th--icon">
                        {iconPrint('F12', () => imprimirWsDoc(t.id, 'F12'))}
                      </TableCell>
                      <TableCell className="doc-th--icon">
                        {iconPrint('Enmienda', () => imprimirWsDoc(t.id, 'Enmienda'))}
                      </TableCell>
                      <TableCell className="doc-th--icon">
                        {iconPrint('DDJJ', () => imprimirWsDoc(t.id, 'DDJJ'))}
                      </TableCell>
                      <TableCell className="doc-th--icon">
                        {iconPrint('certificado', () => imprimirLocalDoc(t.id, 'certificado', t.auto.nroChasis))}
                      </TableCell>
                      <TableCell className="doc-th--icon">
                        {iconPrint('factura', () => imprimirLocalDoc(t.id, 'factura', t.auto.nroChasis))}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" disabled={busy('bundle')} onClick={() => imprimirBundle(t.id)} title="Imprimir todos salvo los forms 01 y 12">
                          {busy('bundle')
                            ? <Loader2 size={13} className="modal-docs__spinner" />
                            : <Printer size={13} />}
                          Todos
                        </Button>
                      </TableCell>
                      <TableCell className="doc-th--icon">
                        <Button
                          size="sm"
                          variant="ghost"
                          title={t.impreso ? 'Ya marcado como impreso' : 'Marcar como impreso'}
                          disabled={!!t.impreso || marcandoImpreso.has(t.id)}
                          onClick={() => !t.impreso && handleMarcarImpreso(t.id)}
                        >
                          {marcandoImpreso.has(t.id)
                            ? <Loader2 size={13} className="modal-docs__spinner" />
                            : <FileCheck size={13} className={t.impreso ? 'impreso-icon--done' : ''} />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {tramites.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={13} className="table-empty">{emptyMsg}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="pagination__info">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
