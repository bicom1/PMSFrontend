import { createContext, forwardRef, useContext, useMemo, useState } from 'react';
import { Inbox, X, ChevronLeft, ChevronRight } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = (message, tone = 'info') => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  };
  const value = useMemo(() => ({
    success: (message) => push(message, 'success'),
    error: (message) => push(message, 'error'),
    info: (message) => push(message, 'info'),
  }), []);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[70] flex w-[min(100%-2rem,22rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`rounded-xl px-4 py-3 text-base font-bold text-white shadow-lg ${toast.tone === 'error' ? 'bg-rose-700' : toast.tone === 'success' ? 'bg-brand-700' : 'bg-ink-900'}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
  };
  const sizes = { sm: 'h-10 px-3 text-base', md: 'h-12 px-4 text-base' };
  return <button type={type} className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition duration-200 sm:hover:-translate-y-0.5 sm:hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}

export function Field({ label, error, children }) {
  return (
    <label className="block">
      {label && <span className="label">{label}</span>}
      {children}
      {error && <span className="mt-1 block text-sm font-bold text-rose-600">{error}</span>}
    </label>
  );
}

export function IconInput({ icon: Icon, className = '', ...props }) {
  return (
    <div className="relative">
      {Icon && <Icon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
      <input className={`field ${Icon ? 'pl-10' : ''} ${className}`} {...props} />
    </div>
  );
}

export const TextInput = forwardRef(function TextInput({ className = '', ...props }, ref) {
  return <input className={`field ${className}`} {...props} ref={ref} />;
});

export const TextArea = forwardRef(function TextArea(props, ref) {
  return <textarea className="area" {...props} ref={ref} />;
});

export const SelectInput = forwardRef(function SelectInput({ children, ...props }, ref) {
  return <select className="field" {...props} ref={ref}>{children}</select>;
});

export function Badge({ tone = 'slate', children }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
    teal: 'bg-teal-50 text-teal-800',
    rose: 'bg-rose-50 text-rose-700',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-sm font-bold ${tones[tone]}`}>{children}</span>;
}

export function RecordState({ unread }) {
  if (unread) {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-sm font-bold text-rose-700"><span className="h-2 w-2 rounded-full bg-rose-600" />Unread</span>;
  }
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-500">Opened</span>;
}

export function statusTone(status) {
  if (status === 'BOOKED' || status === 'COMPLETED') return 'green';
  if (status === 'NOT_BOOKED' || status === 'PENDING') return 'amber';
  return 'slate';
}

export function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-bold text-ink-900">{title}</h2>
          <button type="button" className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-3 text-base font-bold text-slate-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-200 border-t-brand-600" />
      {label}
    </div>
  );
}

export function EmptyState({ title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <Inbox className="mx-auto text-slate-300" size={36} />
      <h3 className="mt-3 text-lg font-bold text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-base font-bold text-slate-500">{text}</p>
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex flex-col gap-3 text-base font-bold text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>{meta.total} records</span>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}><ChevronLeft size={16} /> Previous</Button>
        <span className="px-2 py-2">Page {meta.page} of {meta.totalPages}</span>
        <Button size="sm" variant="secondary" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>Next <ChevronRight size={16} /></Button>
      </div>
    </div>
  );
}

export function PageHeader({ title, text, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl bg-ink-900 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">{title}</h1>
        {text && <p className="mt-2 text-base font-bold text-white sm:text-lg">{text}</p>}
      </div>
      {actions && <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap [&>button]:w-full sm:[&>button]:w-auto">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, className = '' }) {
  return (
    <div className={`card h-full p-4 transition duration-200 sm:p-5 sm:hover:-translate-y-0.5 sm:hover:shadow-lg ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-lg font-bold text-slate-600">{label}</p>
        {Icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-brand-700"><Icon size={18} /></span>}
      </div>
      <p className="mt-2 text-3xl font-bold text-ink-900 sm:text-4xl">{value ?? '—'}</p>
      {hint && <p className="mt-1 text-sm font-bold text-slate-500">{hint}</p>}
    </div>
  );
}

export function SkeletonRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
    </div>
  );
}
