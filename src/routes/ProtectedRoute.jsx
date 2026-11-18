import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { Spinner } from '../components/common/ui.jsx';
import { homeFor } from '../store/store.js';

export default function ProtectedRoute({ roles, children }) {
  const { status, user } = useSelector((state) => state.auth);
  const location = useLocation();
  if (status === 'idle' || status === 'loading') {
    return <div className="grid min-h-screen place-items-center"><Spinner label="Checking your session" /></div>;
  }
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
