import {
  ClipboardList, FileText, LayoutDashboard, LogOut, ScrollText, Settings, Stethoscope,
  UserRound, Users, Building2, ListTree, Database, Shield, BarChart3, UserPlus,
} from 'lucide-react';

export const managerNav = [
  { to: '/manager', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/manager/patients/new', label: 'New Patient Form', icon: UserPlus },
  { to: '/manager/submissions', label: 'Submitted Forms', icon: ClipboardList },
  { to: '/manager/patients', label: 'Patients', icon: Users, end: true },
  { to: '/manager/reports', label: 'Reports', icon: BarChart3 },
  { to: '/manager/profile', label: 'Profile', icon: UserRound },
  { label: 'Logout', icon: LogOut, action: 'logout' },
];

export const doctorNav = [
  { to: '/doctor', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/doctor/patients', label: 'My Patients', icon: Users },
  { to: '/doctor/consultations', label: 'Consultations', icon: Stethoscope },
  { to: '/doctor/profile', label: 'Profile', icon: UserRound },
  { label: 'Logout', icon: LogOut, action: 'logout' },
];

export const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/patients/new', label: 'New Patient Form', icon: UserPlus },
  { to: '/admin/patients', label: 'Patients', icon: Users, end: true },
  { to: '/admin/submissions', label: 'All Submissions', icon: ClipboardList },
  { to: '/admin/doctors', label: 'Doctors', icon: Stethoscope },
  { to: '/admin/managers', label: 'Clinic Managers', icon: UserRound },
  { to: '/admin/users', label: 'Users & Roles', icon: Shield },
  { to: '/admin/departments', label: 'Departments', icon: Building2 },
  { to: '/admin/procedures', label: 'Procedures', icon: ListTree },
  { to: '/admin/master-data', label: 'Master Data', icon: Database },
  { to: '/admin/policy', label: 'Policy Management', icon: ScrollText },
  { to: '/admin/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
  { to: '/admin/profile', label: 'Profile', icon: FileText },
  { label: 'Logout', icon: LogOut, action: 'logout' },
];
