import { useRef, useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';

interface UploadZoneProps {
  accept: string;
  title: string;
  hint: string;
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function UploadZone({ accept, title, hint, onFileSelected, disabled, loading }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFileSelected(file);
  };

  const isDisabled = disabled || loading;

  return (
    <div
      className={`upload-zone${dragActive ? ' upload-zone--active' : ''}${isDisabled ? ' upload-zone--disabled' : ''}`}
      onClick={() => !isDisabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!isDisabled) setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        if (!isDisabled) handleFiles(e.dataTransfer.files);
      }}
    >
      {loading
        ? <Loader2 className="upload-zone__icon upload-zone__icon--spin" size={28} />
        : <UploadCloud className="upload-zone__icon" size={28} />
      }
      <span className="upload-zone__title">{loading ? 'Procesando...' : title}</span>
      <span className="upload-zone__hint">{hint}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={isDisabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
