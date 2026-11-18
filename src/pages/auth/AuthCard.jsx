import { Stethoscope } from 'lucide-react';

export default function AuthCard({ title, text, icon: Icon = Stethoscope, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-card transition duration-200 hover:shadow-xl sm:px-10">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white"><Icon size={26} /></div>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Clinic Patient Management</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl">{title}</h1>
          {text && <p className="mt-3 text-base leading-7 text-slate-500">{text}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
