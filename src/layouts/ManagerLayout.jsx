import { Outlet } from 'react-router-dom';
import AppShell from '../components/layout/AppShell.jsx';
import { managerNav } from '../constants/navigation.js';

export default function ManagerLayout() {
  return <AppShell items={managerNav}><Outlet /></AppShell>;
}
