import { useState } from 'react';
import { FileText, ScrollText, Award, Receipt, Loader2, ExternalLink, Printer } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { apiClient } from '@/api/client';
import type { GestorTramite, TipoFormularioDescarga } from '@shared/types';

interface DocWsItem {
  tipo: TipoFormularioDescarga;
  label: string;
  icono: React.ReactNode;
  conImprimir: boolean;
}

interface DocLocalItem {
  tipo: 'factura' | 'certificado';
  label: string;
  icono: React.ReactNode;
}

function base64ToBlob(base64: string): Blob {
  const bytes = atob(base64);
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
    // mantener vivo mientras dure el diálogo de impresión
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 60000);
  };
}

interface Props {
  tramite: GestorTramite | null;
  onClose: () => void;
}

export function ModalDocumentos({ tramite, onClose }: Props) {
  const [cargando, setCargando] = useState<Set<string>>(new Set());

  if (!tramite) return null;

  const tipoForm01: TipoFormularioDescarga =
    tramite.auto.codigoClase === 6802 ? 'F01importado' : 'F01';

  const docsWs: DocWsItem[] = [
    {
      tipo: tipoForm01,
      label: tipoForm01 === 'F01importado' ? 'Formulario 01 (importado)' : 'Formulario 01 (nacional)',
      icono: <FileText size={15} />,
      conImprimir: true,
    },
    { tipo: 'F12', label: 'Formulario 12', icono: <FileText size={15} />, conImprimir: true },
    { tipo: 'Enmienda', label: 'Hoja de Enmienda', icono: <ScrollText size={15} />, conImprimir: true },
    { tipo: 'DDJJ', label: 'Declaración Jurada', icono: <ScrollText size={15} />, conImprimir: true },
  ];

  const docsLocales: DocLocalItem[] = [
    { tipo: 'certificado', label: 'Certificado de Fábrica', icono: <Award size={15} /> },
    { tipo: 'factura', label: 'Factura', icono: <Receipt size={15} /> },
  ];

  const setLoading = (key: string, on: boolean) =>
    setCargando((prev) => {
      const next = new Set(prev);
      on ? next.add(key) : next.delete(key);
      return next;
    });

  const fetchPdf = async (tipo: TipoFormularioDescarga): Promise<Blob | null> => {
    try {
      const { data } = await apiClient.get<{ pdfBase64: string }>(
        `/api/tramites/${tramite.id}/formulario`,
        { params: { tipo } }
      );
      return base64ToBlob(data.pdfBase64);
    } catch {
      toast.error(`No se pudo obtener ${tipo}`);
      return null;
    }
  };

  const abrirWs = async (tipo: TipoFormularioDescarga) => {
    const key = `${tipo}-abrir`;
    setLoading(key, true);
    try {
      const blob = await fetchPdf(tipo);
      if (blob) window.open(URL.createObjectURL(blob), '_blank');
    } finally {
      setLoading(key, false);
    }
  };

  const imprimirWs = async (tipo: TipoFormularioDescarga) => {
    const key = `${tipo}-print`;
    setLoading(key, true);
    try {
      const blob = await fetchPdf(tipo);
      if (blob) imprimirBlob(blob);
    } finally {
      setLoading(key, false);
    }
  };

  const abrirLocal = (tipo: 'factura' | 'certificado') => {
    window.open(`/api/pdfs/${tipo}/${tramite.auto.nroChasis}`, '_blank');
  };

  const imprimirLocal = async (tipo: 'factura' | 'certificado') => {
    const key = `${tipo}-print`;
    setLoading(key, true);
    try {
      const response = await apiClient.get(`/api/pdfs/${tipo}/${tramite.auto.nroChasis}`, {
        responseType: 'blob',
      });
      imprimirBlob(response.data as Blob);
    } catch {
      toast.error(`No se pudo imprimir ${tipo}`);
    } finally {
      setLoading(key, false);
    }
  };

  return (
    <Dialog open={!!tramite} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {tramite.auto.nroChasis}
          </DialogTitle>
          <DialogDescription>
            {tramite.auto.marcaChasis} {tramite.auto.modelo} &middot; {tramite.titular.nombre} &middot; traID:{' '}
            <span className="modal-docs__tra-id">{tramite.traID}</span>
          </DialogDescription>
        </DialogHeader>      

        <div className="modal-docs__list">
          <p className="modal-docs__section-label">Formularios del WS TRGS</p>
          {docsWs.map((doc) => {
            const isAbrir = cargando.has(`${doc.tipo}-abrir`);
            const isPrint = cargando.has(`${doc.tipo}-print`);
            const busy = isAbrir || isPrint;
            return (
              <div key={doc.tipo} className="modal-docs__item">
                <span className="modal-docs__item-icon">{doc.icono}</span>
                <span className="modal-docs__item-label">{doc.label}</span>
                <div className="modal-docs__item-actions">
                  {doc.conImprimir && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Imprimir"
                      disabled={busy}
                      onClick={() => imprimirWs(doc.tipo)}
                    >
                      {isPrint ? <Loader2 size={13} className="modal-docs__spinner" /> : <Printer size={13} />}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => abrirWs(doc.tipo)}
                  >
                    {isAbrir ? <Loader2 size={13} className="modal-docs__spinner" /> : <ExternalLink size={13} />}
                    {isAbrir ? 'Cargando...' : 'Abrir'}
                  </Button>
                </div>
              </div>
            );
          })}

          <p className="modal-docs__section-label modal-docs__section-label--mt">Archivos locales</p>
          {docsLocales.map((doc) => {
            const isPrint = cargando.has(`${doc.tipo}-print`);
            return (
              <div key={doc.tipo} className="modal-docs__item">
                <span className="modal-docs__item-icon">{doc.icono}</span>
                <span className="modal-docs__item-label">{doc.label}</span>
                <div className="modal-docs__item-actions">
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Imprimir"
                    disabled={isPrint}
                    onClick={() => imprimirLocal(doc.tipo)}
                  >
                    {isPrint ? <Loader2 size={13} className="modal-docs__spinner" /> : <Printer size={13} />}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => abrirLocal(doc.tipo)}>
                    <ExternalLink size={13} />
                    Abrir
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        
         <div className="modal-docs__actions">
          <Button
            variant="default"
            size="sm"
            onClick={() => window.open(`/api/tramites/${tramite.id}/bundle-imprimir`, '_blank')}
          >
            <Printer size={13} />
            Imprimir todos
          </Button>
          <span className="modal-docs__actions-hint">Enmienda · DDJJ · Certificado · Factura</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
