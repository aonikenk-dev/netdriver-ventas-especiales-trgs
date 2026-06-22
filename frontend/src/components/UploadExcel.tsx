import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

interface UploadExcelProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function UploadExcel({ onFileSelected, disabled }: UploadExcelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div
      className={`upload-zone${dragActive ? ' upload-zone--active' : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <UploadCloud className="upload-zone__icon" size={28} />
      <span className="upload-zone__title">Cargar Excel de vehiculos (.xlsx)</span>
      <span className="upload-zone__hint">Arrastra el archivo aqui o hace click para seleccionarlo &mdash; columnas A-U</span>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
