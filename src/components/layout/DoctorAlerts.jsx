import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Bell, X } from 'lucide-react';
import { api } from '../../services/api.js';
import { formatWhen } from '../../utils/format.js';
import { RecordState } from '../common/ui.jsx';

export default function DoctorAlerts() {
  const navigate = useNavigate();
  const role = useSelector((state) => state.auth.user?.role);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const isDoctor = role === 'DOCTOR';

  async function load() {
    const body = await api.get(isDoctor ? '/doctor/notifications' : '/inbox');
    setItems(body.data.items || []);
    setUnread(body.data.unread || 0);
  }

  useEffect(() => {
    if (!role) return undefined;
    load().catch(() => {});
    const timer = setInterval(() => load().catch(() => {}), 20000);
    return () => clearInterval(timer);
  }, [role]);

  function recordPath(item) {
    if (isDoctor) return `/doctor/patients/${item.submissionId}`;
    const base = role === 'ADMIN' ? '/admin/submissions' : '/manager/submissions';
    return `${base}/${item.submissionId}`;
  }

  async function openItem(item) {
    if (isDoctor) await api.post('/doctor/notifications/read', { ids: [item.id] }).catch(() => {});
    setOpen(false);
    navigate(recordPath(item));
    load().catch(() => {});
  }

  async function markAll() {
    const body = await api.post('/doctor/notifications/read', { all: true });
    setItems(body.data.items || []);
    setUnread(body.data.unread || 0);
  }

  const title = isDoctor ? 'Assigned patients' : 'Unread records';

  return (
    <div className="relative">
      <button type="button" className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100" aria-label="Notifications" onClick={() => setOpen((value) => !value)}>
        <Bell size={22} />
        {unread > 0 && <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-bold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-ink-900">{title}</p>
              <p className="text-sm font-bold text-slate-500">{unread > 0 ? `${unread} unread` : 'Nothing unread'}</p>
            </div>
            <div className="flex items-center gap-1">
              {isDoctor && unread > 0 && <button type="button" className="px-2 text-sm font-bold text-brand-700 hover:underline" onClick={markAll}>Mark all read</button>}
              <button type="button" className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-ink-900" aria-label="Close notifications" onClick={() => setOpen(false)}>
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="no-scrollbar max-h-96 space-y-2 overflow-auto">
            {items.length === 0 && <p className="px-1 py-3 text-base font-bold text-slate-600">{isDoctor ? 'No patients have been assigned to you yet.' : 'Every record has been opened.'}</p>}
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => openItem(item)} className={`block w-full rounded-xl border px-3 py-3 text-left text-base transition hover:border-brand-600 ${item.readAt ? 'border-slate-200 text-slate-500' : 'border-rose-200 bg-rose-50/80 text-ink-900'}`}>
                <span className="flex items-start justify-between gap-3">
                  <span className="font-bold">{item.patientName}</span>
                  {!item.readAt && <RecordState unread />}
                </span>
                <span className="mt-1 block font-bold">{item.patientCode} · {item.departmentCode === 'SKIN' ? 'Skin' : 'Surgery'}</span>
                <span className="mt-1 block text-sm font-bold text-slate-500">{item.readAt ? 'Opened' : 'Not opened yet'} · {formatWhen(item.createdAt)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
