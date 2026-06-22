import { useEffect } from 'react';
import { FileText } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { useTramitesStore } from '@/store/useTramitesStore';
import { apiClient } from '@/api/client';
import type { GestorFormulario, GestorTramite } from '@shared/types';

async function abrirFormularioWs(tramite: GestorTramite, tipo: GestorFormulario['tipo']) {
  try {
    const { data } = await apiClient.get<{ pdfBase64: string }>(`/api/tramites/${tramite.id}/formulario`, {
      params: { tipo },
    });
    const blob = base64ToBlob(data.pdfBase64);
    window.open(URL.createObjectURL(blob), '_blank');
  } catch {
    toast.error(`No se pudo obtener ${tipo} para este tramite`);
  }
}

function base64ToBlob(base64: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: 'application/pdf' });
}

function abrirPdfLocal(tipo: 'factura' | 'certificado', chasis: string) {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
  window.open(`${base}/api/pdfs/${tipo}/${chasis}`, '_blank');
}

export function PDFs() {
  const { tramites, fetchTramites } = useTramitesStore();

  useEffect(() => {
    fetchTramites();
  }, [fetchTramites]);

  const conDocumentos = tramites.filter((t) => t.estado === 'ok');

  return (
    <>
      <Topbar title="Documentos" />
      <div className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Visor de documentos</h1>
            <p className="page-header__subtitle">
              Formularios del WS TRGS y archivos locales (factura / certificado) por tramite aprobado.
            </p>
          </div>
        </div>

        <div className="doc-grid">
          {conDocumentos.map((t) => {
            const tipoForm01 = t.auto.codigoClase === 6802 ? 'F01importado' : 'F01';
            return (
              <div key={t.id} className="doc-card">
                <FileText className="doc-card__icon" size={20} />
                <span className="doc-card__title">
                  {t.auto.marcaChasis} {t.auto.modelo}
                </span>
                <span className="doc-card__meta">{t.auto.nroChasis}</span>

                <Button size="sm" variant="secondary" onClick={() => abrirFormularioWs(t, tipoForm01)}>
                  Formulario {tipoForm01 === 'F01importado' ? '01 (importado)' : '01'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => abrirFormularioWs(t, 'F12')}>
                  Formulario 12
                </Button>
                <Button size="sm" variant="outline" onClick={() => abrirPdfLocal('factura', t.auto.nroChasis)}>
                  Factura
                </Button>
                <Button size="sm" variant="outline" onClick={() => abrirPdfLocal('certificado', t.auto.nroChasis)}>
                  Certificado
                </Button>
              </div>
            );
          })}

          {conDocumentos.length === 0 && (
            <div className="table-empty">Todavia no hay tramites con estado OK para mostrar documentos.</div>
          )}
        </div>
      </div>
    </>
  );
}
