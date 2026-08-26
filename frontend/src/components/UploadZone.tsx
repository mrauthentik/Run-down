'use client';

import { useCallback, useState } from 'react';
import { UploadCloud, FileVideo, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/api';

const MAX_FILE_SIZE_MB = 2048;
const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.mpeg', '.3gp'];
const ALLOWED_TYPES = [
  'video/mp4', 'video/quicktime', 'video/x-matroska',
  'video/x-msvideo', 'video/webm', 'video/mpeg', 'video/3gpp',
];

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  disabled?: boolean;
}

export function UploadZone({ onFileSelected, selectedFile, onClear, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_TYPES.includes(file.type)) {
      return `File type not supported. Please upload a video file (${ALLOWED_EXTENSIONS.join(', ')}).`;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`;
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    const err = validate(file);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onFileSelected(file);
  }, [onFileSelected]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  if (selectedFile) {
    return (
      <div className="glass-card p-6 animate-fade-in-up">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--color-accent-glow)', border: '1px solid rgba(124,92,252,0.3)' }}>
            <FileVideo size={22} style={{ color: 'var(--color-accent)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
              {selectedFile.name}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              {formatBytes(selectedFile.size)}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-success)' }} />
              <span className="text-xs" style={{ color: 'var(--color-success)' }}>Ready to convert</span>
            </div>
          </div>
          {!disabled && (
            <button
              onClick={onClear}
              className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--color-text-muted)')}
              aria-label="Remove file"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor="file-upload"
        className={cn(
          'block relative rounded-2xl transition-all duration-200 cursor-pointer',
          isDragging && !disabled ? 'scale-[1.01]' : '',
          disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
        )}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <div
          className={cn(
            'rounded-2xl p-10 text-center transition-all duration-200',
            isDragging
              ? 'gradient-border'
              : 'border border-dashed',
          )}
          style={{
            borderColor: isDragging ? 'transparent' : 'rgba(255,255,255,0.12)',
            background: isDragging
              ? 'rgba(124,92,252,0.06)'
              : 'rgba(255,255,255,0.02)',
          }}
        >
          {/* Upload icon */}
          <div className={cn('mx-auto mb-5 w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300', isDragging ? 'animate-float' : '')}
            style={{ background: isDragging ? 'rgba(124,92,252,0.2)' : 'rgba(255,255,255,0.05)' }}>
            <UploadCloud
              size={30}
              style={{ color: isDragging ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
              className="transition-colors duration-200"
            />
          </div>

          <p className="text-base font-semibold mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
            Drop your video here
          </p>
          <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
            or <span style={{ color: 'var(--color-accent)' }} className="font-medium">browse files</span>
          </p>

          {/* Format chips */}
          <div className="flex flex-wrap gap-2 justify-center">
            {['MP4', 'MOV', 'MKV', 'AVI', 'WebM'].map((fmt) => (
              <span key={fmt}
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>
                {fmt}
              </span>
            ))}
          </div>

          <p className="text-xs mt-4" style={{ color: 'var(--color-text-muted)' }}>
            Max {MAX_FILE_SIZE_MB / 1024} GB
          </p>
        </div>

        <input
          id="file-upload"
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled}
        />
      </label>

      {error && (
        <div className="flex items-start gap-3 rounded-xl p-4 animate-fade-in-up"
          style={{ background: 'var(--color-error-glow)', border: '1px solid rgba(244,88,88,0.2)' }}>
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-error)' }} />
          <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
        </div>
      )}
    </div>
  );
}
