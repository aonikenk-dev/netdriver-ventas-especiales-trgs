import { FileDown, FileSpreadsheet } from 'lucide-react';
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
  if (!remito) return null;

  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
  const fechaFormateada = new Date(remito.creadoEn).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

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
            onClick={() => window.open(`${apiBase}${remito.excelUrl}`, '_blank')}
          >
            <FileSpreadsheet size={13} />
            Excel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => window.open(`${apiBase}${remito.pdfUrl}`, '_blank')}
          >
            <FileDown size={13} />
            PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
