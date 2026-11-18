import { Outlet } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import { adminNav } from '../constants/navigation.js';

export default function AdminLayout() {
  return <AppShell items={adminNav}><Outlet /></AppShell>;
}
