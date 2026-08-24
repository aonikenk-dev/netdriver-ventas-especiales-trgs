import { useEffect, useState } from 'react';
import { FolderOpen, Save, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getConfiguracion, saveConfiguracion } from '@/api/configuracion';

export function Configuracion() {
  const [facturasDir,    setFacturasDir]    = useState('');
  const [certificadosDir, setCertificadosDir] = useState('');
  const [facturaNroRegex, setFacturaNroRegex] = useState('');
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    getConfiguracion()
      .then((cfg) => {
        setFacturasDir(cfg.FACTURAS_DIR ?? '');
        setCertificadosDir(cfg.CERTIFICADOS_DIR ?? '');
        setFacturaNroRegex(cfg.FACTURA_NRO_REGEX ?? String.raw`\d{4}\s*[-–]\s*\d{7,8}`);
      })
      .catch(() => toast.error('No se pudo cargar la configuración'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfiguracion({
        FACTURAS_DIR:      facturasDir.trim(),
        CERTIFICADOS_DIR:  certificadosDir.trim(),
        FACTURA_NRO_REGEX: facturaNroRegex.trim(),
      });
      toast.success('Configuración guardada');
    } catch {
      toast.error('No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Topbar title="Configuración" />
      <div className="app-content">
        <div className="page-header">
          <div>
            <h1 className="page-header__title">Configuración del sistema</h1>
            <p className="page-header__subtitle">
              Ajustes globales del sistema. Los cambios se aplican de inmediato sin reiniciar el servidor.
            </p>
          </div>
        </div>

        <div className="section-card config-section">
          <h2 className="config-section__title">
            <FolderOpen size={16} />
            Directorios de documentos
          </h2>
          <p className="config-section__desc">
            Rutas del servidor donde se guardarán las facturas y los certificados subidos.
            Dentro de cada directorio se crea automáticamente una subcarpeta con la fecha del día.
          </p>

          {/* Facturas */}
          <div className="config-field">
            <label className="config-field__label" htmlFor="facturas-dir">
              Directorio de Facturas
            </label>
            <Input
              id="facturas-dir"
              value={loading ? '' : facturasDir}
              disabled={loading}
              placeholder={loading ? 'Cargando...' : 'Ej: C:\\Documentos\\Facturas o /var/facturas'}
              onChange={(e) => setFacturasDir(e.target.value)}
              className="config-field__input"
            />
            {facturasDir && (
              <div className="config-preview">
                <CheckCircle size={13} />
                <span>
                  Ejemplo de ruta resuelta:{' '}
                  <code>{facturasDir.replace(/[/\\]$/, '')}/2026-08-13/0065-00697045.pdf</code>
                </span>
              </div>
            )}
            <span className="config-field__hint">
              Las facturas se guardan con el número de factura como nombre de archivo.
            </span>
          </div>

          {/* Certificados */}
          <div className="config-field">
            <label className="config-field__label" htmlFor="certificados-dir">
              Directorio de Certificados
            </label>
            <Input
              id="certificados-dir"
              value={loading ? '' : certificadosDir}
              disabled={loading}
              placeholder={loading ? 'Cargando...' : 'Ej: C:\\Documentos\\Certificados o /var/certificados'}
              onChange={(e) => setCertificadosDir(e.target.value)}
              className="config-field__input"
            />
            {certificadosDir && (
              <div className="config-preview">
                <CheckCircle size={13} />
                <span>
                  Ejemplo de ruta resuelta:{' '}
                  <code>{certificadosDir.replace(/[/\\]$/, '')}/2026-08-13/CERT-44321.pdf</code>
                </span>
              </div>
            )}
            <span className="config-field__hint">
              Los certificados se extraen del ZIP y se guardan con su nombre original.
            </span>
          </div>

          {/* Regex de número de factura */}
          <div className="config-field">
            <label className="config-field__label" htmlFor="factura-regex">
              Patrón para número de factura
            </label>
            <Input
              id="factura-regex"
              value={loading ? '' : facturaNroRegex}
              disabled={loading}
              placeholder={String.raw`\d{4}\s*[-–]\s*\d{7,8}`}
              onChange={(e) => setFacturaNroRegex(e.target.value)}
              className="config-field__input font-mono"
            />
            <span className="config-field__hint">
              Expresión regular (RegEx) para encontrar el número de factura en cada página del PDF.
              El primer match se usa como nombre de archivo.
            </span>
          </div>

          <div className="config-section__footer">
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Guardando...' : <><Save size={14} /> Guardar</>}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
