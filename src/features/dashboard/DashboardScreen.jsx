import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts';
import { keepPreviousData } from '@tanstack/react-query';
import { CalendarCheck, CalendarX, ClipboardList, Clock, Stethoscope, UserCheck, UserPlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, RecordState, Spinner, StatCard, statusTone } from '../../components/common/ui.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import { useApiQuery, useQueryError } from '../../services/query.js';
import { errorMessage } from '../../utils/format.js';

export default function DashboardScreen({ role }) {
  const navigate = useNavigate();
  const recordBase = role === 'ADMIN' ? '/admin/submissions' : role === 'DOCTOR' ? '/doctor/patients' : '/manager/submissions';
  const path = role === 'ADMIN' ? '/admin/dashboard' : role === 'DOCTOR' ? '/doctor/dashboard' : '/manager/dashboard';
  const dashboard = useApiQuery(['dashboard', role], path, undefined, {
    staleTime: 0,
    placeholderData: keepPreviousData,
    refetchInterval: role === 'DOCTOR' ? 5_000 : 15_000,
    refetchOnWindowFocus: true,
  });
  useQueryError(dashboard.error);
  const data = dashboard.data?.data;
  if (dashboard.isPending && !data) return <Spinner label="Loading dashboard" />;
  if (!data) {
    return (
      <div className="card p-6">
        <p className="text-lg font-bold text-ink-900">Dashboard unavailable</p>
        <p className="mt-2 text-base font-bold text-slate-600">{errorMessage(dashboard.error) || 'Could not load dashboard data.'}</p>
      </div>
    );
  }
  const stats = role === 'DOCTOR'
    ? [
      { label: 'My patients', value: data.myPatients, icon: Users },
      { label: 'New assignments', value: data.unreadNotifications, icon: UserPlus },
      { label: 'Pending consultations', value: data.pendingConsultations, icon: Clock },
      { label: 'Booked', value: data.totalBooked, icon: CalendarCheck },
    ]
    : [
      { label: 'Total patients', value: data.totalPatients, icon: Users },
      { label: 'Total submissions', value: data.totalSubmissions, icon: ClipboardList },
      { label: 'Booked', value: data.booked, icon: CalendarCheck },
      { label: 'Not booked', value: data.notBooked, icon: CalendarX },
      { label: "Today's registrations", value: data.todayRegistrations, icon: UserPlus },
      ...(role === 'ADMIN' ? [
        { label: 'Active users', value: data.activeUsers, icon: UserCheck },
        { label: 'Doctors', value: data.doctors, icon: Stethoscope },
      ] : []),
    ];
  const gridClass = stats.length === 5
    ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-6'
    : stats.length > 5
      ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-12'
      : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4';
  function cardSpan(index) {
    if (stats.length === 5) return index < 3 ? 'lg:col-span-2' : 'lg:col-span-3';
    if (stats.length > 5) return index < 4 ? 'lg:col-span-3' : 'lg:col-span-4';
    return '';
  }
  return (
    <div className="space-y-5">
      <div className={gridClass}>
        {stats.map((item, index) => <StatCard key={item.label} {...item} className={cardSpan(index)} />)}
      </div>
      {data.analytics && (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="card min-w-0 p-4">
            <h2 className="mb-3 text-xl font-bold">Submissions per day</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.analytics.submissionsPerDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area dataKey="count" stroke="#0f766e" fill="#99f6e4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card min-w-0 overflow-hidden p-4">
            <h2 className="mb-3 text-xl font-bold">Bookings per doctor</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.analytics.bookingsPerDoctor}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="doctor" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="booked" fill="#0f766e" radius={6} />
                  <Bar dataKey="notBooked" fill="#f59e0b" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      {data.departmentStats && (
        <div className="grid gap-4 md:grid-cols-2">
          {data.departmentStats.map((item) => (
            <div key={item.department} className="card p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
              <h3 className="text-xl font-bold">{item.department === 'SKIN' ? 'Skin' : 'Surgery'}</h3>
              <p className="mt-2 text-base font-bold text-slate-600">{item.patients} patients · {item.booked} booked · {item.notBooked} not booked</p>
            </div>
          ))}
        </div>
      )}
      <div className="card p-4">
        <h2 className="mb-3 font-bold">Recent activity</h2>
        <DataTable
          rows={data.recent || []}
          rowKey={(row) => row.id}
          onRow={(row) => navigate(`${recordBase}/${row.id}`)}
          emptyTitle="No submissions yet"
          emptyText="New registrations will show up here."
          columns={[
            { key: 'unread', header: 'Record', render: (row) => <RecordState unread={row.unread} /> },
            { key: 'patientCode', header: 'Patient ID' },
            { key: 'patientName', header: 'Name' },
            { key: 'procedure', header: 'Procedure' },
            { key: 'bookingStatus', header: 'Booking', render: (row) => <Badge tone={statusTone(row.bookingStatus)}>{row.bookingStatus.replace('_', ' ')}</Badge> },
          ]}
        />
      </div>
    </div>
  );
}
