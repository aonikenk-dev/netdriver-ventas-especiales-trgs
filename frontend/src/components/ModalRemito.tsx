import { useState } from 'react';
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Remito } from '@shared/types';

interface Props {
  remito: Remito | null;
  onClose: () => void;
}

export function ModalRemito({ remito, onClose }: Props) {
  const [loadingPdf, setLoadingPdf]   = useState(false);
  const [loadingXlsx, setLoadingXlsx] = useState(false);

  if (!remito) return null;

  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
  const fechaFormateada = new Date(remito.creadoEn).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  async function abrirArchivo(
    url: string,
    setLoading: (v: boolean) => void,
    filename: string,
  ) {
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}${url}`);
      if (!res.ok) throw new Error(`Error ${res.status} al obtener el archivo`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.target = '_blank';
      a.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo abrir el archivo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!remito} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="modal-remito__title">
            Remito RTO-{remito.nroRemito}
          </DialogTitle>
          <DialogDescription>
            {fechaFormateada} &middot; {remito.tramites.length} trámite(s)
          </DialogDescription>
        </DialogHeader>

        <div className="modal-remito__table-wrapper">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Chasis</TableHead>
                <TableHead>Marca / Modelo</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>CUIT</TableHead>
                <TableHead>traID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {remito.tramites.map((t, i) => (
                <TableRow key={t.id}>
                  <TableCell className="modal-remito__num">{i + 1}</TableCell>
                  <TableCell className="data-table__chasis">{t.nroChasis}</TableCell>
                  <TableCell>{t.marcaChasis} {t.modelo}</TableCell>
                  <TableCell>{t.titular}</TableCell>
                  <TableCell className="cell-mono">{t.cuit}</TableCell>
                  <TableCell className="cell-mono">{t.traID ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="modal-remito__footer">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!remito.excelUrl || loadingXlsx}
            title={!remito.excelUrl ? 'Cierre el remito para generar el Excel' : undefined}
            onClick={() => abrirArchivo(
              remito.excelUrl,
              setLoadingXlsx,
              `RTO-${remito.nroRemito}.xlsx`,
            )}
          >
            {loadingXlsx ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
            Excel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={!remito.pdfUrl || loadingPdf}
            title={!remito.pdfUrl ? 'Cierre el remito para generar el PDF' : undefined}
            onClick={() => abrirArchivo(
              remito.pdfUrl,
              setLoadingPdf,
              `RTO-${remito.nroRemito}.pdf`,
            )}
          >
            {loadingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
            PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
