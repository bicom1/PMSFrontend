import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { bootstrapAuth } from './store/authSlice.js';
import { homeFor } from './store/store.js';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import { Spinner } from './components/common/ui.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import ManagerLayout from './layouts/ManagerLayout.jsx';
import DoctorLayout from './layouts/DoctorLayout.jsx';

const Login = lazy(() => import('./pages/auth/Login.jsx'));
const DashboardScreen = lazy(() => import('./features/dashboard/DashboardScreen.jsx'));
const NewPatient = lazy(() => import('./pages/manager/NewPatient.jsx'));
const IntakeForm = lazy(() => import('./features/intake/IntakeForm.jsx'));
const SubmissionBrowser = lazy(() => import('./features/submissions/SubmissionBrowser.jsx'));
const SubmissionRecord = lazy(() => import('./features/submissions/SubmissionRecord.jsx'));
const PatientBrowser = lazy(() => import('./features/patients/PatientBrowser.jsx'));
const PatientProfilePage = lazy(() => import('./pages/shared/PatientProfilePage.jsx'));
const ReportScreen = lazy(() => import('./features/reports/ReportScreen.jsx'));
const ProfilePage = lazy(() => import('./pages/shared/ProfilePage.jsx'));
const UserAdmin = lazy(() => import('./features/admin/AdminScreens.jsx').then((module) => ({ default: module.UserAdmin })));
const DepartmentAdmin = lazy(() => import('./features/admin/AdminScreens.jsx').then((module) => ({ default: module.DepartmentAdmin })));
const ProcedureAdmin = lazy(() => import('./features/admin/AdminScreens.jsx').then((module) => ({ default: module.ProcedureAdmin })));
const MasterDataAdmin = lazy(() => import('./features/admin/AdminScreens.jsx').then((module) => ({ default: module.MasterDataAdmin })));
const PolicyAdmin = lazy(() => import('./features/admin/AdminScreens.jsx').then((module) => ({ default: module.PolicyAdmin })));
const AuditScreen = lazy(() => import('./features/admin/AdminScreens.jsx').then((module) => ({ default: module.AuditScreen })));
const SettingsScreen = lazy(() => import('./features/admin/AdminScreens.jsx').then((module) => ({ default: module.SettingsScreen })));

function RecordPage() {
  const { id } = useParams();
  return <SubmissionRecord id={id} />;
}

export default function App() {
  const dispatch = useDispatch();
  const { status, user } = useSelector((state) => state.auth);
  useEffect(() => { dispatch(bootstrapAuth()); }, [dispatch]);

  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><Spinner /></div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/" element={status === 'authenticated' ? <Navigate to={homeFor(user.role)} replace /> : <Navigate to="/login" replace />} />
        <Route path="/manager" element={<ProtectedRoute roles={['CLINIC_MANAGER', 'ADMIN']}><ManagerLayout /></ProtectedRoute>}>
          <Route index element={<DashboardScreen role="CLINIC_MANAGER" />} />
          <Route path="patients/new" element={<NewPatient />} />
          <Route path="patients/new/skin" element={<IntakeForm departmentCode="SKIN" />} />
          <Route path="patients/new/surgery" element={<IntakeForm departmentCode="SURGERY" />} />
          <Route path="submissions" element={<SubmissionBrowser title="Submitted forms" endpoint="/submissions" basePath="/manager/submissions" />} />
          <Route path="submissions/:id" element={<RecordPage />} />
          <Route path="patients" element={<PatientBrowser basePath="/manager/patients" />} />
          <Route path="patients/:id" element={<PatientProfilePage submissionBase="/manager/submissions" />} />
          <Route path="reports" element={<ReportScreen />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="/doctor" element={<ProtectedRoute roles={['DOCTOR']}><DoctorLayout /></ProtectedRoute>}>
          <Route index element={<DashboardScreen role="DOCTOR" />} />
          <Route path="patients" element={<SubmissionBrowser title="My patients" endpoint="/doctor/patients" basePath="/doctor/patients" doctorMode />} />
          <Route path="patients/:id" element={<RecordPage />} />
          <Route path="consultations" element={<SubmissionBrowser title="Consultations" endpoint="/doctor/patients" basePath="/doctor/patients" doctorMode />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<DashboardScreen role="ADMIN" />} />
          <Route path="patients" element={<PatientBrowser basePath="/admin/patients" />} />
          <Route path="patients/new" element={<NewPatient base="/admin/patients/new" />} />
          <Route path="patients/new/skin" element={<IntakeForm departmentCode="SKIN" />} />
          <Route path="patients/new/surgery" element={<IntakeForm departmentCode="SURGERY" />} />
          <Route path="patients/:id" element={<PatientProfilePage submissionBase="/admin/submissions" />} />
          <Route path="submissions" element={<SubmissionBrowser title="All submissions" endpoint="/submissions" basePath="/admin/submissions" />} />
          <Route path="submissions/:id" element={<RecordPage />} />
          <Route path="doctors" element={<UserAdmin key="doctors" role="DOCTOR" title="Doctors" />} />
          <Route path="managers" element={<UserAdmin key="managers" role="CLINIC_MANAGER" title="Clinic managers" />} />
          <Route path="users" element={<UserAdmin title="Users and roles" />} />
          <Route path="departments" element={<DepartmentAdmin />} />
          <Route path="procedures" element={<ProcedureAdmin />} />
          <Route path="master-data" element={<MasterDataAdmin />} />
          <Route path="policy" element={<PolicyAdmin />} />
          <Route path="reports" element={<ReportScreen allowClinical />} />
          <Route path="audit" element={<AuditScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
