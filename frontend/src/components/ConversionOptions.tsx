'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ALLOWED_FORMATS,
  ALLOWED_VIDEO_CODECS,
  ALLOWED_AUDIO_CODECS,
  ALLOWED_RESOLUTIONS,
  CODEC_FORMAT_COMPAT,
  DEFAULT_OPTIONS,
  CRF_MIN,
  CRF_MAX,
  type ConversionOptions,
  type OutputFormat,
  type VideoCodec,
  type AudioCodec,
  type Resolution,
} from '@run-down/shared';

interface ConversionOptionsProps {
  value: ConversionOptions;
  onChange: (opts: ConversionOptions) => void;
  disabled?: boolean;
}

const FORMAT_LABELS: Record<OutputFormat, string> = {
  mp4: 'MP4',
  webm: 'WebM',
  mov: 'MOV',
};

const VIDEO_CODEC_LABELS: Record<VideoCodec, { label: string; hint: string }> = {
  libx264: { label: 'H.264', hint: 'Best compatibility, fast encoding' },
  libx265: { label: 'H.265 / HEVC', hint: '40% smaller files than H.264' },
  vp9: { label: 'VP9', hint: 'WebM container, royalty-free' },
};

const AUDIO_CODEC_LABELS: Record<AudioCodec, string> = {
  aac: 'AAC (recommended)',
  mp3: 'MP3',
  opus: 'Opus',
};

const RESOLUTION_LABELS: Record<Resolution, string> = {
  original: 'Keep original',
  '1080p': '1080p (Full HD)',
  '720p': '720p (HD)',
  '480p': '480p (SD)',
};

const QUALITY_PRESETS = [
  { label: 'High Quality', crf: 18 },
  { label: 'Balanced', crf: 23 },
  { label: 'Small File', crf: 32 },
];

// ─── Small Select Component ───────────────────────────────────────────────────
function Select<T extends string>({
  label,
  id,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  id: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (val: T) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="form-label">{label}</label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value as T)}
        disabled={disabled}
        className="form-input"
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ConversionOptionsPanel({ value, onChange, disabled }: ConversionOptionsProps) {
  const compatibleFormats = CODEC_FORMAT_COMPAT[value.videoCodec];
  const crfPercent = ((value.crf - CRF_MIN) / (CRF_MAX - CRF_MIN)) * 100;

  const update = (partial: Partial<ConversionOptions>) => {
    const next = { ...value, ...partial };

    // Auto-fix codec/format incompatibility
    if (partial.videoCodec) {
      const compat = CODEC_FORMAT_COMPAT[partial.videoCodec as VideoCodec];
      if (!compat.includes(next.outputFormat)) {
        next.outputFormat = compat[0];
      }
    }

    onChange(next);
  };

  return (
    <div className="space-y-5">
      {/* Video codec (drives format availability) */}
      <div>
        <label className="form-label">Video Codec</label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {ALLOWED_VIDEO_CODECS.map((codec: VideoCodec) => {
            const info = VIDEO_CODEC_LABELS[codec];
            const active = value.videoCodec === codec;
            return (
              <button
                key={codec}
                type="button"
                disabled={disabled}
                onClick={() => update({ videoCodec: codec })}
                className={cn(
                  'relative rounded-xl p-3 text-left transition-all duration-150',
                  active
                    ? 'border'
                    : 'border hover:border-white/20',
                  disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                )}
                style={{
                  background: active ? 'rgba(124,92,252,0.12)' : 'rgba(255,255,255,0.03)',
                  borderColor: active ? 'rgba(124,92,252,0.5)' : 'rgba(255,255,255,0.08)',
                  boxShadow: active ? '0 0 16px rgba(124,92,252,0.15)' : 'none',
                }}
              >
                <span className="block text-xs font-semibold mb-0.5"
                  style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-primary)' }}>
                  {info.label}
                </span>
                <span className="block text-[10px] leading-tight"
                  style={{ color: 'var(--color-text-muted)' }}>
                  {info.hint}
                </span>
                {active && (
                  <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--color-accent)' }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Output format */}
      <Select
        label="Output Format"
        id="output-format"
        value={value.outputFormat}
        onChange={v => update({ outputFormat: v })}
        disabled={disabled}
        options={ALLOWED_FORMATS.map((fmt: OutputFormat) => ({
          value: fmt,
          label: FORMAT_LABELS[fmt],
          disabled: !CODEC_FORMAT_COMPAT[value.videoCodec].includes(fmt),
        }))}
      />

      {/* Audio codec */}
      <Select
        label="Audio Codec"
        id="audio-codec"
        value={value.audioCodec}
        onChange={v => update({ audioCodec: v })}
        disabled={disabled}
        options={ALLOWED_AUDIO_CODECS.map((c: AudioCodec) => ({ value: c, label: AUDIO_CODEC_LABELS[c] }))}
      />

      {/* Resolution */}
      <Select
        label="Resolution"
        id="resolution"
        value={value.resolution}
        onChange={v => update({ resolution: v })}
        disabled={disabled}
        options={ALLOWED_RESOLUTIONS.map((r: Resolution) => ({ value: r, label: RESOLUTION_LABELS[r] }))}
      />

      {/* Quality / CRF */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="form-label mb-0">Quality</label>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-0.5 rounded-md"
              style={{ background: 'rgba(124,92,252,0.15)', color: 'var(--color-accent)' }}>
              CRF {value.crf}
            </span>
          </div>
        </div>

        {/* Preset buttons */}
        <div className="flex gap-2 mb-3">
          {QUALITY_PRESETS.map(preset => (
            <button
              key={preset.crf}
              type="button"
              disabled={disabled}
              onClick={() => update({ crf: preset.crf })}
              className={cn(
                'flex-1 text-xs py-1.5 rounded-lg border transition-all duration-150',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              )}
              style={{
                background: value.crf === preset.crf ? 'rgba(124,92,252,0.15)' : 'rgba(255,255,255,0.04)',
                borderColor: value.crf === preset.crf ? 'rgba(124,92,252,0.4)' : 'rgba(255,255,255,0.08)',
                color: value.crf === preset.crf ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* CRF slider */}
        <div className="relative">
          <input
            type="range"
            min={CRF_MIN}
            max={CRF_MAX}
            value={value.crf}
            disabled={disabled}
            onChange={e => update({ crf: parseInt(e.target.value) })}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${crfPercent}%, rgba(255,255,255,0.12) ${crfPercent}%, rgba(255,255,255,0.12) 100%)`,
              accentColor: 'var(--color-accent)',
            }}
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px]" style={{ color: 'var(--color-success)' }}>Better quality</span>
            <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Smaller file</span>
          </div>
        </div>
      </div>

      {/* VP9/WebM compatibility note */}
      {value.videoCodec === 'vp9' && (
        <div className="flex items-start gap-2.5 rounded-xl p-3 animate-fade-in-up"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-warning)' }} />
          <p className="text-xs" style={{ color: 'var(--color-warning)' }}>
            VP9 only supports WebM output. Format has been set automatically.
          </p>
        </div>
      )}
    </div>
  );
}
