import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../../services/api.js';
import { formatWhen } from '../../utils/format.js';

export default function DoctorAlerts() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    const body = await api.get('/doctor/notifications');
    setItems(body.data.items || []);
    setUnread(body.data.unread || 0);
  }

  useEffect(() => {
    load().catch(() => {});
    const timer = setInterval(() => load().catch(() => {}), 20000);
    return () => clearInterval(timer);
  }, []);

  async function openItem(item) {
    await api.post('/doctor/notifications/read', { ids: [item.id] }).catch(() => {});
    setOpen(false);
    navigate(`/doctor/patients/${item.submissionId}`);
    load().catch(() => {});
  }

  async function markAll() {
    const body = await api.post('/doctor/notifications/read', { all: true });
    setItems(body.data.items || []);
    setUnread(body.data.unread || 0);
  }

  return (
    <div className="relative">
      <button type="button" className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100" aria-label="Patient notifications" onClick={() => setOpen((value) => !value)}>
        <Bell size={20} />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">{unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="font-semibold">Assigned patients</p>
            {unread > 0 && <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={markAll}>Mark all read</button>}
          </div>
          <div className="max-h-80 space-y-2 overflow-auto">
            {items.length === 0 && <p className="px-1 py-2 text-sm text-slate-500">No patients have been assigned to you yet.</p>}
            {items.map((item) => (
              <button key={item.id} type="button" onClick={() => openItem(item)} className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-teal-50 ${item.readAt ? 'text-slate-500' : 'bg-teal-50/70 text-ink-900'}`}>
                <p className="font-medium">{item.patientName}</p>
                <p>{item.patientCode} · {item.departmentCode === 'SKIN' ? 'Skin' : 'Surgery'}</p>
                <p className="text-xs text-slate-400">{formatWhen(item.createdAt)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
