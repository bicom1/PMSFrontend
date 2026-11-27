import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { setSession } from '../../store/authSlice.js';
import { homeFor } from '../../store/store.js';
import { errorMessage } from '../../utils/format.js';
import { Lock, Mail, LogIn } from 'lucide-react';
import { Button, Field, IconInput } from '../../components/common/ui.jsx';
import AuthCard from './AuthCard.jsx';
import PasswordField from './PasswordField.jsx';

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const status = useSelector((state) => state.auth.status);
  const user = useSelector((state) => state.auth.user);
  const [email, setEmail] = useState(location.state?.email || '');
  const notice = location.state?.notice || '';
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') return <Navigate to={homeFor(user.role)} replace />;

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = await api.post('/auth/login', { email, password });
      dispatch(setSession(body.data));
      navigate(homeFor(body.data.user.role));
    } catch (err) {
      const offline = !err.response && (err.code === 'ERR_NETWORK' || err.message?.includes('Network'));
      setError(offline
        ? 'Cannot reach the clinic API. Make sure the server is running on port 5000, then try again.'
        : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Sign in" text="Use the account created for this clinic.">
      <form onSubmit={onSubmit} className="space-y-4">
        {notice && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-base font-bold text-emerald-800">{notice}</p>}
        <Field label="Email or username"><IconInput icon={Mail} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></Field>
        <PasswordField id="login-password" label="Password" icon={Lock} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-base font-bold text-rose-700">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}><LogIn size={18} />{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </AuthCard>
  );
}
