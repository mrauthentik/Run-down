'use client';

import { useState } from 'react';
import { UploadCloud, Clapperboard, Github, Zap, Shield, RefreshCw } from 'lucide-react';
import { UploadZone } from '@/components/UploadZone';
import { ConversionOptionsPanel } from '@/components/ConversionOptions';
import { ProgressView } from '@/components/ProgressView';
import { uploadVideo } from '@/lib/api';
import { DEFAULT_OPTIONS, type ConversionOptions } from '@run-down/shared';

type AppState = 'idle' | 'uploading' | 'processing';

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<ConversionOptions>(DEFAULT_OPTIONS);
  const [appState, setAppState] = useState<AppState>('idle');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = !!file && appState === 'idle';

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitError(null);
    setUploadPercent(0);
    setAppState('uploading');

    try {
      const response = await uploadVideo(file, options, (pct) => {
        setUploadPercent(pct);
      });
      setJobId(response.jobId);
      setAppState('processing');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setAppState('idle');
      setUploadPercent(0);
    }
  };

  const handleReset = () => {
    setFile(null);
    setOptions(DEFAULT_OPTIONS);
    setAppState('idle');
    setUploadPercent(0);
    setJobId(null);
    setSubmitError(null);
  };

  const isLocked = appState !== 'idle';

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Background glow effects ────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, var(--color-accent), transparent 70%)', filter: 'blur(60px)' }} />
        <div className="absolute bottom-[-10%] right-[5%] w-[400px] h-[400px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, #00d4ff, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center animate-pulse-glow"
            style={{ background: 'var(--color-accent)' }}>
            <Clapperboard size={18} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight">Run-down</span>
            <span className="text-xs ml-2 px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(124,92,252,0.15)', color: 'var(--color-accent)' }}>
              Beta
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-6 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <div className="flex items-center gap-2">
            <Zap size={13} style={{ color: 'var(--color-success)' }} />
            <span>Hardware-accelerated</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield size={13} style={{ color: 'var(--color-accent)' }} />
            <span>Files auto-deleted in 1h</span>
          </div>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-start px-4 py-12 md:py-16">
        {/* Hero text */}
        <div className="text-center mb-12 animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 leading-[1.1]">
            Convert video{' '}
            <span className="text-gradient-accent">blazing fast</span>
          </h1>
          <p className="text-base md:text-lg max-w-md mx-auto leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}>
            Upload, choose your codec and format, and download the result.
            Powered by ffmpeg — running in the cloud.
          </p>
        </div>

        {/* ── Main card ─────────────────────────────────────────────────── */}
        <div className="w-full max-w-2xl space-y-4">

          {/* Progress view (replaces upload form once submitted) */}
          {appState === 'processing' && jobId ? (
            <ProgressView
              jobId={jobId}
              uploadPercent={uploadPercent}
              onReset={handleReset}
            />
          ) : (
            <>
              {/* Upload zone */}
              <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <UploadZone
                  onFileSelected={setFile}
                  selectedFile={file}
                  onClear={() => setFile(null)}
                  disabled={isLocked}
                />
              </div>

              {/* Conversion options */}
              {file && (
                <div className="glass-card p-6 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                  <h2 className="text-sm font-semibold mb-5 flex items-center gap-2"
                    style={{ color: 'var(--color-text-secondary)' }}>
                    <RefreshCw size={14} style={{ color: 'var(--color-accent)' }} />
                    Conversion Settings
                  </h2>
                  <ConversionOptionsPanel
                    value={options}
                    onChange={setOptions}
                    disabled={isLocked}
                  />
                </div>
              )}

              {/* Upload progress bar (during upload only) */}
              {appState === 'uploading' && (
                <div className="glass-card p-5 animate-fade-in-up">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Uploading…</span>
                    <span className="text-sm font-mono" style={{ color: 'var(--color-accent)' }}>
                      {uploadPercent}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300 relative overflow-hidden"
                      style={{ width: `${uploadPercent}%`, background: 'var(--color-accent)' }}
                    >
                      <div className="absolute inset-0 animate-shimmer" />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit error */}
              {submitError && (
                <div className="rounded-xl p-4 animate-fade-in-up"
                  style={{ background: 'var(--color-error-glow)', border: '1px solid rgba(244,88,88,0.2)' }}>
                  <p className="text-sm" style={{ color: 'var(--color-error)' }}>{submitError}</p>
                </div>
              )}

              {/* Submit button */}
              <button
                id="convert-btn"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="btn-primary w-full py-3.5 text-sm flex items-center justify-center gap-2.5"
              >
                {appState === 'uploading' ? (
                  <>
                    <UploadCloud size={16} className="animate-bounce" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    {file ? 'Convert Video' : 'Select a file to convert'}
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* ── Features row ──────────────────────────────────────────────── */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
          {[
            {
              icon: <Zap size={18} style={{ color: 'var(--color-accent)' }} />,
              title: 'Real progress',
              desc: 'Actual conversion progress parsed from ffmpeg, not a fake spinner.',
            },
            {
              icon: <Shield size={18} style={{ color: 'var(--color-success)' }} />,
              title: 'Secure by design',
              desc: 'Command injection prevented by strict whitelisting. Files auto-deleted after 1 hour.',
            },
            {
              icon: <RefreshCw size={18} style={{ color: '#00d4ff' }} />,
              title: 'Multiple codecs',
              desc: 'H.264, H.265, VP9 with AAC, MP3, or Opus audio. CRF quality control.',
            },
          ].map((f, i) => (
            <div key={i} className="glass-card glass-card-hover p-5 animate-fade-in-up"
              style={{ animationDelay: `${i * 80 + 200}ms` }}>
              <div className="mb-3">{f.icon}</div>
              <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 text-center py-6 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)' }}>
        <p className="text-xs">
          Run-down © {new Date().getFullYear()} — Built with Next.js + ffmpeg
        </p>
      </footer>
    </div>
  );
}
