import { useEffect, useState } from 'react';
import { FolderOpen, Save, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getConfiguracion, saveConfiguracion } from '@/api/configuracion';

export function Configuracion() {
  const [pdfDir, setPdfDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfiguracion()
      .then((cfg) => setPdfDir(cfg.PDF_DIR ?? ''))
      .catch(() => toast.error('No se pudo cargar la configuración'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfiguracion({ PDF_DIR: pdfDir.trim() });
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
            Documentos
          </h2>
          <p className="config-section__desc">
            Ruta del servidor donde están almacenados los archivos PDF de facturas y certificados.
          </p>

          <div className="config-field">
            <label className="config-field__label" htmlFor="pdf-dir">
              Directorio de PDFs
            </label>
            <Input
              id="pdf-dir"
              value={loading ? '' : pdfDir}
              disabled={loading}
              placeholder={loading ? 'Cargando...' : 'Ej: C:\\Facturas o /var/facturas'}
              onChange={(e) => setPdfDir(e.target.value)}
              className="config-field__input"
            />
            <span className="config-field__hint">
              Los archivos deben nombrarse{' '}
              <code>F&#123;chasis&#125;.pdf</code> (factura) y{' '}
              <code>C&#123;chasis&#125;.pdf</code> (certificado).
            </span>
          </div>

          {pdfDir && (
            <div className="config-preview">
              <CheckCircle size={13} />
              <span>
                Ejemplo de ruta resuelta:{' '}
                <code>{pdfDir.replace(/[/\\]$/, '')}&#47;F8AJFA01234X567890.pdf</code>
              </span>
            </div>
          )}

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
