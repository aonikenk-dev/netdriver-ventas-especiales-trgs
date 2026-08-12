import { useEffect, useState } from 'react';
import { ChevronRight, FileDown, FileSpreadsheet, FolderOpen, FolderClosed, Plus } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ModalRemito } from '@/components/ModalRemito';
import { useRemitosStore } from '@/store/useRemitosStore';
import type { Remito } from '@shared/types';

type ConfirmState =
  | { tipo: 'nuevo' }
  | { tipo: 'cerrar'; id: number; nroRemito: number }
  | { tipo: 'abrir';  id: number; nroRemito: number };

export function Remitos() {
  const { remitos, remitoAbierto, loading, procesando, fetchRemitos, abrirNuevo, cerrar, abrir } = useRemitosStore();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [modalRemito, setModalRemito] = useState<Remito | null>(null);

  useEffect(() => { fetchRemitos(); }, [fetchRemitos]);

  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

  const handleConfirmar = async () => {
    if (!confirm) return;
    try {
      if (confirm.tipo === 'nuevo') {
        const r = await abrirNuevo();
        toast.success(`Remito RTO-${r.nroRemito} abierto`);
      } else if (confirm.tipo === 'cerrar') {
        const r = await cerrar(confirm.id);
        toast.success(`Remito RTO-${r.nroRemito} cerrado${r.pdfUrl ? ' — PDF generado' : ''}`);
      } else if (confirm.tipo === 'abrir') {
        const r = await abrir(confirm.id);
        toast.success(`Remito RTO-${r.nroRemito} abierto`);
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (e instanceof Error ? e.message : 'No se pudo completar la acción');
      toast.error(msg);
    } finally {
      setConfirm(null);
      fetchRemitos();
    }
  };

  // Texto del diálogo de confirmación
  const dialogTitle = confirm
    ? confirm.tipo === 'nuevo'  ? 'Abrir nuevo remito'
    : confirm.tipo === 'cerrar' ? `Cerrar remito RTO-${confirm.nroRemito}`
    :                              `Abrir remito RTO-${confirm.nroRemito}`
    : '';

  const dialogBody = confirm
    ? confirm.tipo === 'nuevo'
      ? remitoAbierto
        ? `El remito RTO-${remitoAbierto.nroRemito} está activo y se cerrará (se generará su PDF). ¿Confirmás abrir uno nuevo?`
        : '¿Confirmás abrir un nuevo remito?'
      : confirm.tipo === 'cerrar'
      ? 'Esta acción finalizará el remito y generará el PDF con los trámites actuales. No se podrán agregar más trámites hasta que se vuelva a abrir.'
      : remitoAbierto
      ? `El remito RTO-${remitoAbierto.nroRemito} está activo y se cerrará (se generará su PDF). ¿Confirmás abrir el remito RTO-${confirm.nroRemito}?`
      : `¿Confirmás reabrir el remito RTO-${confirm.nroRemito}?`
    : '';

  const btnLabel = confirm
    ? confirm.tipo === 'nuevo'  ? 'Abrir nuevo'
    : confirm.tipo === 'cerrar' ? 'Cerrar remito'
    :                              'Abrir remito'
    : '';

  return (
    <>
      <Topbar title="Remitos" />
      <div className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Módulo de remitos</h1>
            <p className="page-header__subtitle">
              Abrí un remito activo, agregá trámites desde la tabla de Trámites o Documentos y cerralo para generar el PDF.
            </p>
          </div>
          <Button onClick={() => setConfirm({ tipo: 'nuevo' })} disabled={procesando}>
            <Plus size={15} className="mr-1" />
            Abrir nuevo remito
          </Button>
        </div>

        {/* Remito activo */}
        {remitoAbierto ? (
          <div className="section-card upload-card mb-4">
            <div className="toolbar mb-2">
              <span className="remito-item__numero">RTO-{remitoAbierto.nroRemito}</span>
              <Badge variant="secondary" className="ml-2">Abierto</Badge>
              <span className="toolbar__hint ml-auto">
                {remitoAbierto.tramites.length} trámite(s) agregado(s)
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirm({ tipo: 'cerrar', id: remitoAbierto.id, nroRemito: remitoAbierto.nroRemito })}
                disabled={procesando}
              >
                <FolderClosed size={14} className="mr-1" />
                Cerrar remito
              </Button>
            </div>
            <div className="remito-list">
              {remitoAbierto.tramites.map((t) => (
                <div key={t.id} className="remito-item">
                  <span>
                    <span className="text-lg tabular-nums text-amber-900">{t.nroChasis}</span>
                    {' '}&mdash;{' '}{t.marcaChasis} {t.modelo} &mdash; {t.titular}
                  </span>
                  <span className="remito-item__meta">traID {t.traID}</span>
                </div>
              ))}
              {remitoAbierto.tramites.length === 0 && (
                <div className="table-empty">
                  Sin trámites aún. Usá el botón "Enviar a remito" desde la tabla de Trámites o de Documentos.
                </div>
              )}
            </div>
          </div>
        ) : (
          !loading && (
            <div className="section-card upload-card mb-4">
              <div className="table-empty">
                No hay remito activo. Hacé clic en "Abrir nuevo remito" para comenzar.
              </div>
            </div>
          )
        )}

        {/* Lista de todos los remitos */}
        <h2 className="remitos-section-title">Todos los remitos</h2>
        <div className="remito-list">
          {remitos.map((r) => (
            <div key={r.id} className="remito-item remito-item--generado">
              <button className="remito-item__clickable" onClick={() => setModalRemito(r)}>
                <span className="remito-item__numero">RTO-{r.nroRemito}</span>
                <Badge variant={r.estado === 'abierto' ? 'secondary' : 'outline'} className="ml-2 text-xs">
                  {r.estado === 'abierto' ? 'Abierto' : 'Cerrado'}
                </Badge>
                <span className="remito-item__meta">{r.tramites?.length ?? r.tramiteIds.length} trámite(s)</span>
                <ChevronRight size={13} className="remito-item__chevron" />
              </button>
              <span className="remito-item__links">
                {r.pdfUrl && (
                  <Button size="sm" variant="outline" onClick={() => window.open(`${apiBase}${r.pdfUrl}`, '_blank')}>
                    <FileDown size={14} /> PDF
                  </Button>
                )}
                {r.excelUrl && (
                  <Button size="sm" variant="outline" onClick={() => window.open(`${apiBase}${r.excelUrl}`, '_blank')}>
                    <FileSpreadsheet size={14} /> Excel
                  </Button>
                )}
                {r.estado === 'abierto' ? (
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setConfirm({ tipo: 'cerrar', id: r.id, nroRemito: r.nroRemito })}
                    disabled={procesando}
                    title="Cerrar remito"
                  >
                    <FolderClosed size={14} />
                  </Button>
                ) : (
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setConfirm({ tipo: 'abrir', id: r.id, nroRemito: r.nroRemito })}
                    disabled={procesando}
                    title="Abrir remito"
                  >
                    <FolderOpen size={14} />
                  </Button>
                )}
              </span>
            </div>
          ))}
          {remitos.length === 0 && !loading && (
            <div className="table-empty">Todavía no se crearon remitos.</div>
          )}
        </div>
      </div>

      {/* Diálogo de confirmación unificado */}
      <Dialog open={!!confirm} onOpenChange={(open) => { if (!open) setConfirm(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={procesando}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmar} disabled={procesando}>
              {procesando ? 'Procesando...' : btnLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModalRemito remito={modalRemito} onClose={() => setModalRemito(null)} />
    </>
  );
}
