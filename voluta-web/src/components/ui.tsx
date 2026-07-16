import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import s from './ui.module.css';

// ---------- Button ----------

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variantClass = variant === 'primary' ? s.buttonPrimary : variant === 'secondary' ? s.buttonSecondary : s.buttonGhost;
  return <button className={[s.button, variantClass, className].filter(Boolean).join(' ')} {...props} />;
}

// ---------- Form fields ----------

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={s.field}>
      <label className={s.label}>{label}</label>
      {children}
      {hint && !error && <span className={s.hint}>{hint}</span>}
      {error && <span className={s.errorText}>{error}</span>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={s.input} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={s.textarea} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={s.select} {...props} />;
}

// ---------- Card ----------

export function Card({
  children,
  hover = false,
  onClick,
  className,
}: {
  children: ReactNode;
  hover?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      className={[s.card, hover ? s.cardHover : '', className].filter(Boolean).join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      {children}
    </div>
  );
}

// ---------- Badge ----------

type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger';

const BADGE_CLASS: Record<BadgeTone, string> = {
  neutral: s.badgeNeutral,
  accent: s.badgeAccent,
  success: s.badgeSuccess,
  danger: s.badgeDanger,
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={[s.badge, BADGE_CLASS[tone]].join(' ')}>{children}</span>;
}

// ---------- Banner (erro) ----------

export function ErrorBanner({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className={[s.banner, s.bannerError].join(' ')} role="alert">
      {children}
    </div>
  );
}
