import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, Stethoscope, X } from 'lucide-react';
import DoctorAlerts from './DoctorAlerts.jsx';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../../services/api.js';
import { clearSession } from '../../store/authSlice.js';
import { roleLabel } from '../../utils/format.js';

export default function AppShell({ items, children }) {
  const [open, setOpen] = useState(false);
  const [clinicName, setClinicName] = useState('Clinic');
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/branding').then((body) => {
      if (body.data?.clinicName) setClinicName(body.data.clinicName);
    }).catch(() => {});
  }, []);

  async function logout() {
    try { await api.post('/auth/logout'); } catch { /* cookie may already be gone */ }
    dispatch(clearSession());
    navigate('/login');
  }

  const nav = (
    <nav className="flex h-full flex-col overflow-hidden bg-ink-900 text-slate-200">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><Stethoscope size={18} /></div>
        <div>
          <p className="text-base font-semibold text-white">{clinicName}</p>
          <p className="text-xs text-slate-400">Patient management</p>
        </div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-hidden px-3">
        {items.map((item) => (
          item.action === 'logout' ? (
            <button key={item.label} type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-300 transition duration-200 hover:bg-white/10 hover:text-white">
              <item.icon size={18} /> {item.label}
            </button>
          ) : (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition duration-200 ${isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
              <item.icon size={18} /> {item.label}
            </NavLink>
          )
        ))}
      </div>
      <div className="border-t border-white/10 px-4 py-3 text-sm">
        <p className="font-medium text-white">{user?.fullName}</p>
        <p className="text-xs text-slate-400">{roleLabel(user?.role)}</p>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden overflow-hidden lg:block lg:sticky lg:top-0 lg:h-screen">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink-950/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="relative h-full w-72">{nav}</div>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
          <button type="button" className="rounded-lg p-2 transition hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <p className="text-sm text-slate-500">{roleLabel(user?.role)} workspace</p>
          <div className="flex items-center gap-1">
            {user?.role === 'DOCTOR' && <DoctorAlerts />}
            <button type="button" className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(false)} aria-label="Menu"><X size={18} className="opacity-0" /></button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
