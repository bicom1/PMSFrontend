import { useState } from 'react';
import { Building2, KeyRound, Mail, Phone, Shield, User } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../../services/api.js';
import { clearSession } from '../../store/authSlice.js';
import { errorMessage, roleLabel } from '../../utils/format.js';
import { Button, Field, PageHeader, TextInput, useToast } from '../../components/common/ui.jsx';

export default function ProfilePage() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const toast = useToast();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNext] = useState('');

  async function onSubmit(event) {
    event.preventDefault();
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password updated. Sign in again.');
      dispatch(clearSession());
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader title="Profile" text="Your account details come from the clinic directory." />
      <section className="card space-y-3 p-5 text-base">
        <p className="flex items-center gap-2"><User size={16} className="text-slate-400" /><span className="text-slate-400">Name</span> · {user.fullName}</p>
        <p className="flex items-center gap-2"><Mail size={16} className="text-slate-400" /><span className="text-slate-400">Email</span> · {user.email || '—'}</p>
        <p className="flex items-center gap-2"><Phone size={16} className="text-slate-400" /><span className="text-slate-400">Contact number</span> · {user.phone || '—'}</p>
        <p className="flex items-center gap-2"><Shield size={16} className="text-slate-400" /><span className="text-slate-400">Role</span> · {roleLabel(user.role)}</p>
        <p className="flex items-center gap-2"><Building2 size={16} className="text-slate-400" /><span className="text-slate-400">Departments</span> · {user.departments?.map((item) => item.name).join(', ') || '—'}</p>
      </section>
      <form className="card space-y-3 p-5" onSubmit={onSubmit}>
        <h2 className="flex items-center gap-2 text-xl font-semibold"><KeyRound size={18} /> Change password</h2>
        <Field label="Current password"><TextInput type="password" value={currentPassword} onChange={(event) => setCurrent(event.target.value)} required /></Field>
        <Field label="New password"><TextInput type="password" value={newPassword} onChange={(event) => setNext(event.target.value)} required /></Field>
        <Button type="submit">Update password</Button>
      </form>
    </div>
  );
}
