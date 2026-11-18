import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { BootScreen } from '../components/common/ClinicLogo.jsx';
import { homeFor } from '../store/store.js';

export default function ProtectedRoute({ roles, children }) {
  const { status, user } = useSelector((state) => state.auth);
  const location = useLocation();
  if (status === 'idle' || status === 'loading') {
    return <BootScreen />;
  }
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
