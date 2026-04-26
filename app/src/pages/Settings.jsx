import { useState, useEffect } from 'react';
import { Film, Image, RotateCcw, Power } from 'lucide-react';

const DEFAULT = {
  video: { crf: 23, vsync: 'vfr', audioBitrate: '192k' },
  image: { jpegQuality: 95, pdfDpi: 150 },
};

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/5 p-5 flex flex-col gap-5">
      <div className="flex items-center gap-2 text-white/70">
        <Icon size={16} />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm text-white/80">{label}</span>
        {hint && <span className="text-xs text-white/30">{hint}</span>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Slider({ value, min, max, step = 1, onChange, displayValue }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-36 accent-indigo-500 cursor-pointer"
      />
      <span className="text-xs text-white/60 w-10 text-right tabular-nums">
        {displayValue ?? value}
      </span>
    </div>
  );
}

function Select({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="appearance-none bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:border-indigo-500/60 cursor-pointer"
    >
      {options.map(o => (
        <option key={o.value} value={o.value} className="bg-[#1a1a2e]">{o.label}</option>
      ))}
    </select>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState(DEFAULT);
  const [saved, setSaved] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState(false);

  useEffect(() => {
    window.electronAPI?.getAutoLaunch().then(v => setAutoLaunch(!!v));
  }, []);

  useEffect(() => {
    window.electronAPI?.getSettings().then(s => {
      if (s) setSettings(s);
    });
  }, []);

  const update = (section, key, value) => {
    setSettings(prev => {
      const next = { ...prev, [section]: { ...prev[section], [key]: value } };
      window.electronAPI?.saveSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      return next;
    });
  };

  const reset = () => {
    setSettings(DEFAULT);
    window.electronAPI?.saveSettings(DEFAULT);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const crfQuality = crf => {
    if (crf <= 18) return '최고';
    if (crf <= 23) return '높음';
    if (crf <= 28) return '보통';
    if (crf <= 35) return '낮음';
    return '최저';
  };

  return (
    <div className="flex flex-col h-full p-6 gap-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">설정</h1>
          <p className="text-white/40 text-sm mt-1">변환 품질 전역 설정 — 우클릭 변환에도 적용됩니다</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-emerald-400">저장됨</span>}
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
          >
            <RotateCcw size={12} />
            기본값 복원
          </button>
        </div>
      </div>

      <Section icon={Power} title="시스템">
        <Row label="시작 시 자동 실행" hint="Windows 로그인 시 앱을 자동으로 시작합니다">
          <button
            onClick={() => {
              const next = !autoLaunch;
              setAutoLaunch(next);
              window.electronAPI?.setAutoLaunch(next);
            }}
            className={`relative w-10 h-5 rounded-full transition-colors ${autoLaunch ? 'bg-indigo-500' : 'bg-white/10'}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${autoLaunch ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </Row>
      </Section>

      <Section icon={Film} title="영상 설정">
        <Row
          label="영상 화질 (CRF)"
          hint={`낮을수록 고화질 · 파일 크기 증가 — 현재: ${crfQuality(settings.video.crf)}`}
        >
          <Slider
            value={settings.video.crf}
            min={1} max={51}
            onChange={v => update('video', 'crf', v)}
            displayValue={settings.video.crf}
          />
        </Row>

        <Row
          label="프레임레이트 모드"
          hint="CFR: AVI 등 구형 포맷 호환 · VFR: 원본 유지"
        >
          <Select
            value={settings.video.vsync}
            options={[
              { value: 'cfr', label: 'CFR (고정, 호환성 우선)' },
              { value: 'vfr', label: 'VFR (가변, 원본 유지)' },
            ]}
            onChange={v => update('video', 'vsync', v)}
          />
        </Row>

        <Row
          label="오디오 비트레이트"
          hint="높을수록 음질 향상 · 파일 크기 증가"
        >
          <Select
            value={settings.video.audioBitrate}
            options={[
              { value: '128k', label: '128 kbps' },
              { value: '192k', label: '192 kbps (기본)' },
              { value: '256k', label: '256 kbps' },
              { value: '320k', label: '320 kbps' },
            ]}
            onChange={v => update('video', 'audioBitrate', v)}
          />
        </Row>
      </Section>

      <Section icon={Image} title="이미지 설정">
        <Row
          label="JPEG 품질"
          hint="JPG / JPEG 변환 시 적용 · 높을수록 고화질"
        >
          <Slider
            value={settings.image.jpegQuality}
            min={1} max={100}
            onChange={v => update('image', 'jpegQuality', v)}
            displayValue={`${settings.image.jpegQuality}%`}
          />
        </Row>

        <Row
          label="PDF → 이미지 해상도 (DPI)"
          hint="PDF를 이미지로 변환할 때 적용"
        >
          <Select
            value={settings.image.pdfDpi}
            options={[
              { value: 72,  label: '72 DPI (저해상도)' },
              { value: 96,  label: '96 DPI' },
              { value: 150, label: '150 DPI (기본)' },
              { value: 200, label: '200 DPI' },
              { value: 300, label: '300 DPI (고해상도)' },
            ]}
            onChange={v => update('image', 'pdfDpi', Number(v))}
          />
        </Row>
      </Section>
    </div>
  );
}
