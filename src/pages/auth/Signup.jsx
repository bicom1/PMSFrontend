import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { homeFor } from '../../store/store.js';
import { errorMessage } from '../../utils/format.js';
import { Lock, Mail, Phone, User, UserPlus } from 'lucide-react';
import { Button, Field, IconInput } from '../../components/common/ui.jsx';
import AuthCard from './AuthCard.jsx';
import PasswordField from './PasswordField.jsx';

export default function Signup() {
  const navigate = useNavigate();
  const status = useSelector((state) => state.auth.status);
  const user = useSelector((state) => state.auth.user);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') return <Navigate to={homeFor(user.role)} replace />;

  async function onSubmit(event) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/signup', { fullName, phone, email, password });
      navigate('/login', {
        replace: true,
        state: { email, notice: 'Account created. Sign in to open the dashboard.' },
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Create account" text="The first account is the administrator. The password needs upper and lower case letters and a number.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name"><IconInput icon={User} value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required /></Field>
        <Field label="Contact number"><IconInput icon={Phone} value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" required /></Field>
        <Field label="Email"><IconInput icon={Mail} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></Field>
        <PasswordField id="signup-password" label="Password" icon={Lock} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        <PasswordField id="signup-confirm-password" label="Confirm password" icon={Lock} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}><UserPlus size={18} />{busy ? 'Creating account…' : 'Create account'}</Button>
        <p className="text-center text-base text-slate-500">Already have an account? <Link className="font-medium text-brand-700 underline-offset-2 transition hover:text-brand-600 hover:underline" to="/login">Sign in</Link></p>
      </form>
    </AuthCard>
  );
}
