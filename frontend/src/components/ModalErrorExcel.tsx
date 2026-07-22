import { XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { ExcelImportRowError } from '@shared/types';

interface Props {
  error: ExcelImportRowError | null;
  onClose: () => void;
}

export function ModalErrorExcel({ error, onClose }: Props) {
  if (!error) return null;

  const { datos } = error;
  const hayDatos = datos && Object.values(datos).some(Boolean);

  return (
    <Dialog open={!!error} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Error en fila #{error.fila}</DialogTitle>
          <DialogDescription>
            Detalle del problema detectado al parsear esta fila del Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="modal-error-excel">
          <div className="modal-error-excel__motivo">
            <XCircle size={15} className="modal-error-excel__motivo-icon" />
            <p>{error.motivo}</p>
          </div>

          {hayDatos ? (
            <>
              <p className="modal-error-excel__label">Datos parciales recuperados</p>
              <dl className="modal-error-excel__datos">
                {datos?.facturaNro && (
                  <>
                    <dt>Nro. Factura</dt>
                    <dd>{datos.facturaNro}</dd>
                  </>
                )}
                {datos?.chasis && (
                  <>
                    <dt>Chasis</dt>
                    <dd>{datos.chasis}</dd>
                  </>
                )}
                {datos?.titular && (
                  <>
                    <dt>Titular</dt>
                    <dd>{datos.titular}</dd>
                  </>
                )}
                {datos?.cuit && (
                  <>
                    <dt>CUIT</dt>
                    <dd>{datos.cuit}</dd>
                  </>
                )}
                {datos?.codFabrica && (
                  <>
                    <dt>Cód. Fábrica</dt>
                    <dd>{datos.codFabrica}</dd>
                  </>
                )}
              </dl>
            </>
          ) : (
            <p className="modal-error-excel__no-datos">
              No se recuperaron datos parciales de esta fila.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
