'use client';

import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Zap, Download, RotateCcw, Timer, FileDown } from 'lucide-react';
import { getJobStatus, getDownloadUrl, formatBytes } from '@/lib/api';
import type { JobStatusResponse } from '@run-down/shared';

interface ProgressViewProps {
  jobId: string;
  uploadPercent: number; // 0-100 XHR upload progress
  onReset: () => void;
}

type Phase = 'uploading' | 'queued' | 'processing' | 'done' | 'failed';

const POLL_INTERVAL_MS = 2000;

function getPhase(
  uploadPercent: number,
  status?: string,
): Phase {
  if (uploadPercent < 100) return 'uploading';
  if (!status || status === 'queued') return 'queued';
  if (status === 'processing') return 'processing';
  if (status === 'done') return 'done';
  return 'failed';
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ percent, color = 'var(--color-accent)', animate = true }: {
  percent: number;
  color?: string;
  animate?: boolean;
}) {
  return (
    <div className="relative w-full h-2 rounded-full overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.08)' }}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden"
        style={{ width: `${percent}%`, background: color }}
      >
        {animate && percent < 100 && percent > 0 && (
          <div className="absolute inset-0 animate-shimmer" />
        )}
      </div>
    </div>
  );
}

// ─── Phase labels ─────────────────────────────────────────────────────────────
const PHASE_CONFIG: Record<Phase, { icon: React.ReactNode; label: string; color: string }> = {
  uploading: {
    icon: <RotateCcw size={16} className="animate-spin" />,
    label: 'Uploading…',
    color: 'var(--color-accent)',
  },
  queued: {
    icon: <Clock size={16} />,
    label: 'Queued',
    color: 'var(--color-warning)',
  },
  processing: {
    icon: <Zap size={16} />,
    label: 'Converting…',
    color: 'var(--color-accent)',
  },
  done: {
    icon: <CheckCircle size={16} />,
    label: 'Complete',
    color: 'var(--color-success)',
  },
  failed: {
    icon: <XCircle size={16} />,
    label: 'Failed',
    color: 'var(--color-error)',
  },
};

export function ProgressView({ jobId, uploadPercent, onReset }: ProgressViewProps) {
  const [jobStatus, setJobStatus] = useState<(JobStatusResponse & { queuePosition?: number }) | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  const phase = getPhase(uploadPercent, jobStatus?.status);
  const phaseConfig = PHASE_CONFIG[phase];

  // ── Calculate combined display progress ───────────────────────────────────
  let displayPercent = 0;
  let displayLabel = '';

  switch (phase) {
    case 'uploading':
      displayPercent = uploadPercent * 0.3; // upload = 0-30%
      displayLabel = `Uploading — ${uploadPercent}%`;
      break;
    case 'queued':
      displayPercent = 30;
      displayLabel = jobStatus?.queuePosition
        ? `Queue position: #${jobStatus.queuePosition}`
        : 'Waiting in queue…';
      break;
    case 'processing':
      displayPercent = 30 + (jobStatus?.progress ?? 0) * 0.7; // conversion = 30-100%
      displayLabel = `Converting — ${jobStatus?.progress ?? 0}%`;
      break;
    case 'done':
      displayPercent = 100;
      displayLabel = 'Conversion complete!';
      break;
    case 'failed':
      displayPercent = 0;
      displayLabel = 'Conversion failed';
      break;
  }

  // ── Polling ───────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (!jobId || phase === 'done' || phase === 'failed') return;
    try {
      const status = await getJobStatus(jobId);
      setJobStatus(status);
      setPollError(null);
    } catch (err) {
      setPollError(err instanceof Error ? err.message : 'Failed to fetch status');
    }
  }, [jobId, phase]);

  useEffect(() => {
    if (uploadPercent < 100) return; // don't poll until upload done
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll, uploadPercent]);

  const downloadUrl = getDownloadUrl(jobId);

  return (
    <div className="glass-card p-6 space-y-5 animate-fade-in-up">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span style={{ color: phaseConfig.color }}>{phaseConfig.icon}</span>
          <span className="font-semibold text-sm" style={{ color: phaseConfig.color }}>
            {phaseConfig.label}
          </span>
        </div>
        <span className="text-xs font-mono px-2 py-1 rounded-md"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}>
          {jobId.slice(0, 8)}…
        </span>
      </div>

      {/* Progress bar */}
      {phase !== 'failed' && (
        <div className="space-y-2">
          <ProgressBar
            percent={Math.round(displayPercent)}
            color={phase === 'done' ? 'var(--color-success)' : 'var(--color-accent)'}
            animate={phase !== 'done'}
          />
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {displayLabel}
          </p>
        </div>
      )}

      {/* Queue info */}
      {phase === 'queued' && jobStatus?.queuePosition && jobStatus.queuePosition > 1 && (
        <div className="flex items-center gap-3 rounded-xl p-4"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <Timer size={16} style={{ color: 'var(--color-warning)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-warning)' }}>
              #{jobStatus.queuePosition} in queue
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(245,158,11,0.7)' }}>
              Your conversion will start soon
            </p>
          </div>
        </div>
      )}

      {/* Poll error */}
      {pollError && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Polling paused: {pollError} — retrying…
        </p>
      )}

      {/* Success state */}
      {phase === 'done' && jobStatus && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(34,211,162,0.07)', border: '1px solid rgba(34,211,162,0.2)' }}>
            <div className="flex items-center gap-2">
              <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
              <span className="font-semibold text-sm" style={{ color: 'var(--color-success)' }}>
                Ready to download
              </span>
            </div>
            {jobStatus.outputSize && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(34,211,162,0.8)' }}>
                <FileDown size={13} />
                <span>Output: {formatBytes(jobStatus.outputSize)}</span>
              </div>
            )}
            <p className="text-xs" style={{ color: 'rgba(34,211,162,0.6)' }}>
              File expires{' '}
              {new Date(jobStatus.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <a
            href={downloadUrl}
            download
            className="btn-primary flex items-center justify-center gap-2.5 w-full text-center"
            style={{ textDecoration: 'none', display: 'flex' }}
          >
            <Download size={16} />
            Download Converted Video
          </a>
        </div>
      )}

      {/* Failure state */}
      {phase === 'failed' && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="rounded-xl p-4"
            style={{ background: 'var(--color-error-glow)', border: '1px solid rgba(244,88,88,0.25)' }}>
            <div className="flex items-center gap-2 mb-2">
              <XCircle size={16} style={{ color: 'var(--color-error)' }} />
              <span className="font-semibold text-sm" style={{ color: 'var(--color-error)' }}>
                Conversion failed
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(244,88,88,0.8)' }}>
              {jobStatus?.error ?? 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
          <button onClick={onReset} className="btn-primary w-full flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)', boxShadow: 'none' }}>
            <RotateCcw size={15} />
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
