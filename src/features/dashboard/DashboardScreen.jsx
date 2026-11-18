import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts';
import { CalendarCheck, CalendarX, ClipboardList, Clock, Stethoscope, UserCheck, UserPlus, Users } from 'lucide-react';
import { api } from '../../services/api.js';
import { errorMessage } from '../../utils/format.js';
import { PageHeader, Spinner, StatCard, useToast } from '../../components/common/ui.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import { Badge, statusTone } from '../../components/common/ui.jsx';

export default function DashboardScreen({ role }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  useEffect(() => {
    const path = role === 'ADMIN' ? '/admin/dashboard' : role === 'DOCTOR' ? '/doctor/dashboard' : '/manager/dashboard';
    api.get(path).then((body) => setData(body.data)).catch((error) => toast.error(errorMessage(error)));
  }, [role, toast]);
  if (!data) return <Spinner label="Loading dashboard" />;
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
  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" text="Live clinic activity from the patient record." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => <StatCard key={item.label} {...item} />)}
      </div>
      {data.analytics && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-3 text-xl font-semibold">Submissions per day</h2>
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
          <div className="card p-4">
            <h2 className="mb-3 text-xl font-semibold">Bookings per doctor</h2>
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
              <h3 className="text-xl font-semibold">{item.department === 'SKIN' ? 'Skin' : 'Surgery'}</h3>
              <p className="mt-2 text-sm text-slate-500">{item.patients} patients · {item.booked} booked · {item.notBooked} not booked</p>
            </div>
          ))}
        </div>
      )}
      <div className="card p-4">
        <h2 className="mb-3 font-semibold">Recent activity</h2>
        <DataTable
          rows={data.recent || []}
          rowKey={(row) => row.id}
          emptyTitle="No submissions yet"
          emptyText="New registrations will show up here."
          columns={[
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
