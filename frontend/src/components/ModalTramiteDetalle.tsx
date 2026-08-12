import { useEffect, useState } from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { GestorTramite, TramiteDatosUpdate } from '@shared/types';

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', enviando: 'Enviando...', ok: 'OK', error: 'Error', descartado: 'Descartado',
};

interface FormState {
  nroChasis: string;
  facturaNro: string;
  facturaFecha: string;
  marcaChasis: string;
  modelo: string;
  nroMotor: string;
  marcaMotor: string;
  ano: string;
  codFabrica: string;
  facturaMonto: string;
  certificadoFabrica: string;
  nombre: string;
  cuit: string;
  formularioNro01: string;
  formularioNro12: string;
}

function fromTramite(t: GestorTramite): FormState {
  return {
    nroChasis:          t.auto.nroChasis          ?? '',
    facturaNro:         t.auto.facturaNro         ?? '',
    facturaFecha:       t.auto.facturaFecha        ?? '',
    marcaChasis:        t.auto.marcaChasis         ?? '',
    modelo:             t.auto.modelo              ?? '',
    nroMotor:           t.auto.nroMotor            ?? '',
    marcaMotor:         t.auto.marcaMotor          ?? '',
    ano:                t.auto.ano                ?? '',
    codFabrica:         t.auto.codFabrica          ?? '',
    facturaMonto:       t.auto.facturaMonto        ?? '',
    certificadoFabrica: t.auto.certificadoFabrica  ?? '',
    nombre:             t.titular.nombre           ?? '',
    cuit:               t.titular.cuit             ?? '',
    formularioNro01:    t.formularioNro01          ?? '',
    formularioNro12:    t.formularioNro12          ?? '',
  };
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  type?: string;
  className?: string;
}

function Field({ label, value, onChange, disabled, type = 'text', className }: FieldProps) {
  return (
    <div className={`modal-detalle__field${className ? ` ${className}` : ''}`}>
      <label className="modal-detalle__field-label">{label}</label>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface Props {
  tramite: GestorTramite | null;
  onClose: () => void;
  onSave: (id: number, datos: TramiteDatosUpdate) => Promise<void>;
}

export function ModalTramiteDetalle({ tramite, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tramite) {
      setForm(fromTramite(tramite));
      setError(null);
    }
  }, [tramite?.id]);

  if (!tramite || !form) return null;

  const esEditable = tramite.estado === 'pendiente' || tramite.estado === 'error';

  const set = <K extends keyof FormState>(key: K, val: string) =>
    setForm((prev) => prev ? { ...prev, [key]: val } : prev);

  const handleGuardar = async () => {
    if (!esEditable || !form) return;
    setGuardando(true);
    setError(null);
    try {
      await onSave(tramite.id, form);
      toast.success('Cambios guardados correctamente');
      onClose();
    } catch (e) {
      const msg: string =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (e instanceof Error ? e.message : 'Error al guardar');
      setError(msg);
      toast.error(msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={!!tramite} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl modal-detalle">
        <DialogHeader>
          <DialogTitle className="modal-detalle__title">
            Trámite #{tramite.id}
            <Badge variant={tramite.estado as never} className="ml-2">
              {ESTADO_LABEL[tramite.estado]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono">{tramite.auto.nroChasis}</span>
            {' '}·{' '}{tramite.titular.nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="modal-detalle__body">

          {tramite.estado === 'error' && tramite.errorDesc && (
            <div className="modal-detalle__error-banner">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{tramite.errorDesc}</span>
            </div>
          )}

          {!esEditable && (
            <div className="modal-detalle__readonly-notice">
              <Lock size={12} className="inline mr-1.5" />
              Vista de solo lectura — el trámite está en estado {ESTADO_LABEL[tramite.estado].toLowerCase()}.
            </div>
          )}

          {/* VEHÍCULO */}
          <section>
            <p className="modal-detalle__section-title">Vehículo</p>
            <div className="modal-detalle__grid">
              <Field label="N° Chasis" value={form.nroChasis} onChange={(v) => set('nroChasis', v)} disabled={!esEditable} className="modal-detalle__field--span2" />
              <Field label="Marca"        value={form.marcaChasis}  onChange={(v) => set('marcaChasis', v)}  disabled={!esEditable} />
              <Field label="Modelo"       value={form.modelo}       onChange={(v) => set('modelo', v)}       disabled={!esEditable} />
              <Field label="N° Motor"     value={form.nroMotor}     onChange={(v) => set('nroMotor', v)}     disabled={!esEditable} />
              <Field label="Marca Motor"  value={form.marcaMotor}   onChange={(v) => set('marcaMotor', v)}   disabled={!esEditable} />
              <Field label="Año"          value={form.ano}          onChange={(v) => set('ano', v)}          disabled={!esEditable} />
              <Field label="Cód. Fábrica" value={form.codFabrica}   onChange={(v) => set('codFabrica', v)}   disabled={!esEditable} />
              <Field label="N° Factura"   value={form.facturaNro}   onChange={(v) => set('facturaNro', v)}   disabled={!esEditable} />
              <Field label="Fecha Factura" value={form.facturaFecha} onChange={(v) => set('facturaFecha', v)} disabled={!esEditable} type="date" />
              <Field label="Monto Factura"     value={form.facturaMonto}      onChange={(v) => set('facturaMonto', v)}      disabled={!esEditable} />
              <Field label="Certif. Fábrica"   value={form.certificadoFabrica} onChange={(v) => set('certificadoFabrica', v)} disabled={!esEditable} />
            </div>
          </section>

          {/* CARGADO */}
          <section>
            <p className="modal-detalle__section-title">Registro</p>
            <div className="modal-detalle__field modal-detalle__field--span2">
              <label className="modal-detalle__field-label">Fecha de carga</label>
              <div className="modal-detalle__locked">
                {tramite.creadoEn
                  ? new Date(tramite.creadoEn).toLocaleString('es-AR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : '—'}
              </div>
            </div>
          </section>

          {/* TITULAR */}
          <section>
            <p className="modal-detalle__section-title">Titular</p>
            <div className="modal-detalle__grid">
              <Field label="Nombre (Apellido, Nombre)" value={form.nombre} onChange={(v) => set('nombre', v)} disabled={!esEditable} className="modal-detalle__field--span2" />
              <Field label="CUIT"  value={form.cuit}   onChange={(v) => set('cuit', v)}   disabled={!esEditable} />
            </div>
          </section>

          {/* FORMULARIOS */}
          <section>
            <p className="modal-detalle__section-title">Formularios</p>
            <div className="modal-detalle__grid">
              <Field label="Form. 01" value={form.formularioNro01} onChange={(v) => set('formularioNro01', v)} disabled={!esEditable} />
              <Field label="Form. 12" value={form.formularioNro12} onChange={(v) => set('formularioNro12', v)} disabled={!esEditable} />
            </div>
          </section>

          {error && (
            <div className="modal-detalle__error-banner">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="modal-detalle__footer">
          <Button variant="outline" size="sm" onClick={onClose}>
            {esEditable ? 'Cancelar' : 'Cerrar'}
          </Button>
          {esEditable && (
            <Button size="sm" disabled={guardando} onClick={handleGuardar}>
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
