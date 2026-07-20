import { useEffect, useMemo, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { Topbar } from '@/components/layout/Topbar';
import { UploadExcel } from '@/components/UploadExcel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTramitesStore } from '@/store/useTramitesStore';
import type { EstadoTramite, CodigoClase } from '@shared/types';

const ESTADO_LABEL: Record<EstadoTramite, string> = {
  pendiente: 'Pendiente',
  enviando: 'Enviando...',
  ok: 'OK',
  error: 'Error',
};

const NI_LABEL: Record<CodigoClase, string> = {
  6801: 'Nacional',
  6802: 'Importado',
};

export function Tramites() {
  const { tramites, loading, enviando, fetchTramites, importarDesdeExcel, actualizarFormulario, enviarAlWs } =
    useTramitesStore();
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchTramites();
  }, [fetchTramites]);

  const seleccionables = useMemo(() => tramites.filter((t) => t.estado === 'pendiente'), [tramites]);

  const toggle = (id: number) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async (file: File) => {
    try {
      const { creados, errores } = await importarDesdeExcel(file);
      toast.success(`Excel procesado: ${creados} tramite(s) creado(s)`, {
        description: errores > 0 ? `${errores} fila(s) con errores fueron omitidas` : undefined,
      });
    } catch {
      toast.error('No se pudo procesar el Excel');
    }
  };

  const handleEnviar = async () => {
    if (seleccion.size === 0) return;
    try {
      await enviarAlWs([...seleccion]);
      toast.success('Tramites enviados a TRGS (mock)');
      setSeleccion(new Set());
    } catch {
      toast.error('Fallo la comunicacion con el WS de TRGS');
    }
  };

  return (
    <>
      <Topbar title="Tramites" />
      <div className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Inscripcion de vehiculos nuevos</h1>
            <p className="page-header__subtitle">
              Carga el Excel, completa los numeros de formulario y envia a SUATS para generar el tramite registral.
            </p>
          </div>
        </div>

        <div className="section-card upload-card">
          <UploadExcel onFileSelected={handleImport} />
        </div>

        <div className="toolbar">
          <Button onClick={handleEnviar} disabled={seleccion.size === 0 || enviando}>
            {enviando ? 'Enviando...' : `Enviar SUATS (${seleccion.size})`}
          </Button>
          <span className="toolbar__hint">{seleccionables.length} tramite(s) pendientes de envio</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>Chasis</TableHead>
              <TableHead>Titular</TableHead>
              <TableHead>N/I</TableHead>
              <TableHead>Form. 01</TableHead>
              <TableHead>Form. 12</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>traID / detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tramites.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={seleccion.has(t.id)}
                    disabled={t.estado !== 'pendiente'}
                    onChange={() => toggle(t.id)}
                  />
                </TableCell>
                <TableCell className="data-table__chasis">{t.auto.nroChasis}</TableCell>
                <TableCell>{t.titular.nombre}</TableCell>
                <TableCell>
                  <Badge variant="ok">{NI_LABEL[t.auto.codigoClase]}</Badge>
                </TableCell>
                <TableCell>
                  <Input
                    className="data-table__num-input"
                    defaultValue={t.formularioNro01 ?? ''}
                    placeholder="01-..."
                    onBlur={(e) => actualizarFormulario(t.id, { formularioNro01: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="data-table__num-input"
                    defaultValue={t.formularioNro12 ?? ''}
                    placeholder="12-..."
                    onBlur={(e) => actualizarFormulario(t.id, { formularioNro12: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={t.estado}>{ESTADO_LABEL[t.estado]}</Badge>
                </TableCell>
                <TableCell className="cell-mono">
                  {t.estado === 'ok' && t.traID}
                  {t.estado === 'error' && <span className="cell-error">{t.errorDesc}</span>}
                </TableCell>
              </TableRow>
            ))}
            {!loading && tramites.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="table-empty">
                  Sin tramites cargados todavia. Importa un Excel para comenzar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
