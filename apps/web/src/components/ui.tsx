import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------- Layout bits

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-xl border border-line bg-panel', className)}>{children}</div>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="display text-3xl text-ink sm:text-4xl">{children}</h2>
      {right}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-4xl sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cx('h-4 w-4', className)} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 10h11M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="mt-auto flex items-center justify-between border-t border-dashed border-line pt-4 text-sm font-medium text-accent hover:text-good"
    >
      {children}
      <Arrow />
    </Link>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 p-6 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{children}</p>;
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />;
}

// ---------------------------------------------------------------- Buttons

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  busy?: boolean;
};

export function buttonClass(variant: ButtonProps['variant'] = 'secondary', size: ButtonProps['size'] = 'md') {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
    size === 'md' ? 'px-5 py-2.5 text-sm' : 'px-3.5 py-1.5 text-xs',
    variant === 'primary' && 'bg-accent text-accent-ink hover:bg-good',
    variant === 'secondary' && 'border border-line bg-panel-2 text-ink hover:border-faint',
    variant === 'ghost' && 'text-muted hover:bg-panel-2 hover:text-ink',
    variant === 'danger' && 'border border-bad/50 text-bad hover:bg-bad/10',
  );
}

export function Button({ variant, size, busy, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button className={cx(buttonClass(variant, size), className)} disabled={disabled || busy} {...rest}>
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Form fields

const inputClass =
  'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-accent focus:outline-none';

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
}

function FieldWrap({ label, error, hint, className, id, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-bad">{error}</p> : hint ? <p className="mt-1 text-xs text-faint">{hint}</p> : null}
    </div>
  );
}

export function TextField({ label, error, hint, className, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${rest.name}`;
  return (
    <FieldWrap label={label} error={error} hint={hint} className={className} id={id}>
      <input id={id} className={cx(inputClass, error && 'border-bad')} aria-invalid={!!error} {...rest} />
    </FieldWrap>
  );
}

export function MoneyField(props: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return <TextField inputMode="decimal" placeholder="0.00" autoComplete="off" {...props} />;
}

export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...rest
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = `f-${rest.name}`;
  return (
    <FieldWrap label={label} error={error} hint={hint} className={className} id={id}>
      <select id={id} className={cx(inputClass, error && 'border-bad')} {...rest}>
        {children}
      </select>
    </FieldWrap>
  );
}

export function TextArea({ label, error, hint, className, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = `f-${rest.name}`;
  return (
    <FieldWrap label={label} error={error} hint={hint} className={className} id={id}>
      <textarea id={id} rows={4} className={cx(inputClass, 'resize-y', error && 'border-bad')} {...rest} />
    </FieldWrap>
  );
}

// ---------------------------------------------------------------- Modal

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx(
        'm-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-panel p-0 text-ink backdrop:bg-black/70',
        wide ? 'max-w-2xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="display text-3xl">{title}</h2>
            <button onClick={onClose} className="rounded-full p-1 text-muted hover:text-ink" aria-label="Close">
              <svg viewBox="0 0 20 20" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" fill="none">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
