import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rise rounded-3xl border border-line bg-surface p-4 ${className}`}>{children}</div>
);

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' };
export function Button({ variant = 'ghost', className = '', ...p }: BtnProps) {
  const v = variant === 'primary' ? 'bg-accent text-[#10140a] font-bold' : variant === 'danger' ? 'bg-danger/15 text-danger' : 'bg-surface2 text-fg';
  return <button {...p} className={`min-h-12 rounded-2xl px-5 font-display font-semibold transition active:scale-[.97] disabled:opacity-40 ${v} ${className}`} />;
}

/** משך בפורמט עברי: המספר ב-LTR מבודד, והיחידה בטקסט רגיל (כדי שלא יתהפך סדר). */
export const Dur = ({ min }: { min: number }) => (
  <span>
    {min >= 60 ? <span className="num">{Math.floor(min / 60)}:{String(Math.round(min % 60)).padStart(2, '0')}</span> : <span className="num">{Math.round(min)}</span>}
    {min >= 60 ? ' ש׳' : ' דק׳'}
  </span>
);

export const Chip = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <span className={`inline-flex items-center rounded-full bg-surface2 px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>
);

export const Label = ({ children }: { children: ReactNode }) => <div className="mb-1 text-sm font-medium text-muted">{children}</div>;

export const inputCls = 'min-h-12 w-full rounded-2xl border border-line bg-surface2 px-4 text-base outline-none focus:border-accent';

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div className="rise max-h-[90dvh] w-full overflow-y-auto rounded-t-[2rem] border-t border-line bg-surface p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
        {children}
      </div>
    </div>
  );
}

export function Ring({ value, size = 168, stroke = 14, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg) scaleX(-1)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export type Tab = 'today' | 'week' | 'plan' | 'settings';
const Svg = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const TABS: [Tab, string, string][] = [
  ['today', 'היום', 'M12 3a9 9 0 100 18 9 9 0 000-18zM10 8.5l5 3.5-5 3.5z'],
  ['week', 'שבוע', 'M4 6h16M4 12h16M4 18h10'],
  ['plan', 'תוכנית', 'M5 20V10M12 20V4M19 20v-7'],
  ['settings', 'הגדרות', 'M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M8 15v4'],
];
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(([id, label, icon]) => (
          <button key={id} onClick={() => onChange(id)} className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${tab === id ? 'text-accent-ink' : 'text-muted'}`}>
            <Svg d={icon} />{label}
          </button>
        ))}
      </div>
    </nav>
  );
}
