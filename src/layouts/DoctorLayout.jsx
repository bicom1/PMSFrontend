import { Outlet } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import { doctorNav } from '../constants/navigation.js';

export default function DoctorLayout() {
  return <AppShell items={doctorNav}><Outlet /></AppShell>;
}
