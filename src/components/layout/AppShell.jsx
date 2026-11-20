import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import DoctorAlerts from './DoctorAlerts.jsx';
import ClinicLogo from '../common/ClinicLogo.jsx';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../../services/api.js';
import { clearSession } from '../../store/authSlice.js';

export default function AppShell({ items, children }) {
  const [open, setOpen] = useState(false);
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onDashboard = pathname === '/admin' || pathname === '/manager' || pathname === '/doctor';

  async function logout() {
    try { await api.post('/auth/logout'); } catch { /* cookie may already be gone */ }
    dispatch(clearSession());
    navigate('/login');
  }

  const links = items.filter((item) => item.action !== 'logout');
  const logoutItem = items.find((item) => item.action === 'logout');
  const nav = (
    <nav className="flex h-full flex-col bg-ink-900 text-slate-200">
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-4">
        {links.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-bold transition duration-200 ${isActive ? 'bg-white/10 text-white' : 'text-slate-200 hover:bg-white/10 hover:text-white'}`}>
            <item.icon size={20} className="shrink-0" /> <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </div>
      {logoutItem && (
        <div className="border-t border-white/10 px-3 py-4">
          <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-base font-bold text-rose-100 transition duration-200 hover:bg-rose-500/20 hover:text-white">
            <logoutItem.icon size={20} className="shrink-0" /> {logoutItem.label}
          </button>
        </div>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[288px_1fr]">
      <aside className="hidden overflow-hidden lg:block lg:sticky lg:top-0 lg:h-screen">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-ink-950/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="relative h-full w-[min(100%,20rem)] shadow-2xl">{nav}</div>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 bg-ink-900 text-white">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-3 py-3 sm:px-6">
            <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition hover:bg-white/10 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
            <ClinicLogo className="h-14 w-14 shrink-0 sm:h-16 sm:w-16" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold uppercase tracking-[0.14em] text-teal-100 sm:text-sm">Enfield Royal Clinics</p>
              {onDashboard && (
                <>
                  <h1 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">Dashboard</h1>
                  <p className="truncate text-sm font-bold text-slate-300">Live clinic activity from the patient record.</p>
                </>
              )}
            </div>
            <div className="ml-auto shrink-0">
              {['ADMIN', 'CLINIC_MANAGER', 'DOCTOR'].includes(user?.role) && <DoctorAlerts />}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
