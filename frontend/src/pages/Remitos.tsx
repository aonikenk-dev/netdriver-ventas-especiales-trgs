import { useEffect, useState } from 'react';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useTramitesStore } from '@/store/useTramitesStore';
import { useRemitosStore } from '@/store/useRemitosStore';

export function Remitos() {
  const { tramitesImpresos, removerImpresos } = useTramitesStore();
  const { remitos, generando, fetchRemitos, crearRemito } = useRemitosStore();
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchRemitos();
  }, [fetchRemitos]);

  const toggle = (id: number) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerar = async () => {
    try {
      const ids = [...seleccion];
      const remito = await crearRemito(ids);
      removerImpresos(ids);
      toast.success(`Remito ${remito.numero} generado`);
      setSeleccion(new Set());
    } catch {
      toast.error('No se pudo generar el remito');
    }
  };

  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

  return (
    <>
      <Topbar title="Remitos" />
      <div className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Modulo de remitos</h1>
            <p className="page-header__subtitle">
              Selecciona tramites aprobados para agrupar en un remito con numeracion correlativa.
            </p>
          </div>
        </div>

        <div className="section-card upload-card">
          <div className="toolbar">
            <Button onClick={handleGenerar} disabled={seleccion.size === 0 || generando}>
              {generando ? 'Generando...' : `Generar remito (${seleccion.size})`}
            </Button>
            <span className="toolbar__hint">{tramitesImpresos.length} tramite(s) impresos disponibles para remito</span>
          </div>

          <div className="remito-list">
            {tramitesImpresos.map((t) => (
              <label key={t.id} className="remito-item">
                <span>
                  <input
                    type="checkbox"
                    checked={seleccion.has(t.id)}
                    onChange={() => toggle(t.id)}
                  />{' '}
                  <span className="cell-mono">{t.auto.nroChasis}</span> &mdash; {t.auto.marcaChasis}{' '}
                  {t.auto.modelo} &mdash; {t.titular.nombre}
                </span>
                <span className="remito-item__meta">traID {t.traID}</span>
              </label>
            ))}
            {tramitesImpresos.length === 0 && (
              <div className="table-empty">
                No hay trámites marcados como impresos. Imprimí los formularios desde la tabla de Trámites y cerrá el modal marcando como impreso.
              </div>
            )}
          </div>
        </div>

        <h2 className="remitos-section-title">Remitos generados</h2>
        <div className="remito-list">
          {remitos.map((r) => (
            <div key={r.id} className="remito-item">
              <span>
                <span className="remito-item__numero">{r.numero}</span>
                <span className="remito-item__meta"> &mdash; {r.tramiteIds.length} tramite(s)</span>
              </span>
              <span className="remito-item__links">
                <Button size="sm" variant="outline" onClick={() => window.open(`${apiBase}${r.pdfUrl}`, '_blank')}>
                  <FileDown size={14} /> PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(`${apiBase}${r.excelUrl}`, '_blank')}>
                  <FileSpreadsheet size={14} /> Excel
                </Button>
              </span>
            </div>
          ))}
          {remitos.length === 0 && <div className="table-empty">Todavia no se generaron remitos.</div>}
        </div>
      </div>
    </>
  );
}
