import { CheckCircle, AlertTriangle, XCircle, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { GestorTramite, TramiteLog } from '@shared/types';

const NIVEL_ICON: Record<TramiteLog['nivel'], React.ReactNode> = {
  info: <CheckCircle size={14} />,
  warning: <AlertTriangle size={14} />,
  error: <XCircle size={14} />,
};

const OPERACION_LABEL: Record<TramiteLog['operacion'], string> = {
  eco: 'ECO',
  abrir_sesion: 'SESIÓN',
  generar_tramite_01: 'TRÁMITE',
  cerrar_sesion: 'CIERRE',
  interno: 'INTERNO',
};

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return ts;
  }
}

interface Props {
  tramite: GestorTramite | null;
  onClose: () => void;
}

export function ModalLogs({ tramite, onClose }: Props) {
  if (!tramite) return null;

  const logs = tramite.logs ?? [];

  return (
    <Dialog open={!!tramite} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Log de trámite #{tramite.id}</DialogTitle>
          <DialogDescription>
            {tramite.auto.nroChasis} &middot; {tramite.titular.nombre}
          </DialogDescription>
        </DialogHeader>

        {tramite.estado === 'error' && tramite.errorDesc && (
          <div className="log-error-summary">
            <AlertCircle size={15} className="log-error-summary__icon" />
            <span className="log-error-summary__text">{tramite.errorDesc}</span>
          </div>
        )}

        <div className="log-list">
          {logs.length === 0 && (
            <p className="log-list__empty">Sin registros de log para este trámite.</p>
          )}
          {logs.map((log, i) => (
            <div key={i} className={`log-entry log-entry--${log.nivel}`}>
              <div className="log-entry__header">
                <span className={`log-entry__nivel-icon log-entry__nivel-icon--${log.nivel}`}>
                  {NIVEL_ICON[log.nivel]}
                </span>
                <span className="log-entry__operacion">
                  {OPERACION_LABEL[log.operacion]}
                </span>
                <span className="log-entry__timestamp">{formatTimestamp(log.timestamp)}</span>
                {log.fuenteMensaje && (
                  <span className={`log-entry__fuente log-entry__fuente--${log.fuenteMensaje}`}>
                    {log.fuenteMensaje === 'netdriver' ? 'NetDriver' : 'TRGS'}
                  </span>
                )}
              </div>
              <p className="log-entry__mensaje">{log.mensaje}</p>
              {log.detalle && (
                <code className="log-entry__detalle">{log.detalle}</code>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
