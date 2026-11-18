import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { api } from '../../services/api.js';
import { errorMessage } from '../../utils/format.js';
import { Button, PageHeader, TextInput, useToast } from '../../components/common/ui.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import { Pagination } from '../../components/common/ui.jsx';
import { http } from '../../services/api.js';

export default function ReportScreen({ allowClinical = false }) {
  const toast = useToast();
  const [query, setQuery] = useState({ page: 1, departmentCode: '', bookingStatus: '', dateFrom: '', dateTo: '', search: '', referredBy: '', remarkCategory: '' });
  const [report, setReport] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get('/master-data', { type: 'REFERRAL_SOURCE', active: 'true' }).then((body) => setReferrals(body.data)).catch(() => {});
    if (allowClinical) api.get('/master-data', { type: 'REMARK_CATEGORY', active: 'true' }).then((body) => setCategories(body.data)).catch(() => {});
  }, [allowClinical]);

  useEffect(() => {
    const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value));
    if (!allowClinical) delete params.remarkCategory;
    Promise.all([api.get('/reports', params), api.get('/reports/analytics', params)])
      .then(([list, chart]) => { setReport(list); setAnalytics(chart.data); })
      .catch((error) => toast.error(errorMessage(error)));
  }, [query, allowClinical, toast]);

  async function download(path, filename) {
    const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value && value !== 1 || value === 0));
    delete params.page;
    const response = await http.get(path, { params, responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" text={allowClinical ? 'Exports include prescriptions and clinical remarks.' : 'Exports include operational data only. Prescriptions stay with clinicians and administrators.'} actions={<>
        <Button variant="secondary" onClick={() => download('/reports/export.csv', 'cpms-report.csv')}><Download size={18} /> Export CSV</Button>
        <Button onClick={() => download('/reports/export.xlsx', 'cpms-report.xlsx')}><FileSpreadsheet size={18} /> Export Excel</Button>
      </>} />
      <div className="card grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
        <TextInput placeholder="Name, phone, or ID" value={query.search} onChange={(event) => setQuery({ ...query, page: 1, search: event.target.value })} />
        <select className="field" value={query.departmentCode} onChange={(event) => setQuery({ ...query, page: 1, departmentCode: event.target.value })}>
          <option value="">All departments</option><option value="SKIN">Skin</option><option value="SURGERY">Surgery</option>
        </select>
        <select className="field" value={query.bookingStatus} onChange={(event) => setQuery({ ...query, page: 1, bookingStatus: event.target.value })}>
          <option value="">Any booking</option><option value="BOOKED">Booked</option><option value="NOT_BOOKED">Not booked</option>
        </select>
        <select className="field" value={query.referredBy} onChange={(event) => setQuery({ ...query, page: 1, referredBy: event.target.value })}>
          <option value="">Any referral</option>
          {referrals.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {allowClinical && (
          <select className="field" value={query.remarkCategory} onChange={(event) => setQuery({ ...query, page: 1, remarkCategory: event.target.value })}>
            <option value="">Any remark category</option>
            {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        )}
        <TextInput type="date" value={query.dateFrom} onChange={(event) => setQuery({ ...query, page: 1, dateFrom: event.target.value })} />
        <TextInput type="date" value={query.dateTo} onChange={(event) => setQuery({ ...query, page: 1, dateTo: event.target.value })} />
      </div>
      {analytics && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <h2 className="font-semibold">Booked vs not booked · {analytics.conversion.rate}%</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'Booked', value: analytics.conversion.booked }, { name: 'Not booked', value: analytics.conversion.notBooked }]} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                    <Cell fill="#0f766e" /><Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card p-4">
            <h2 className="font-semibold">Procedures</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.proceduresPerDepartment}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="procedure" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f766e" radius={6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      <div className="card p-4">
        <p className="mb-3 text-sm text-slate-500">{report?.meta?.total || 0} matching records</p>
        <DataTable
          rows={report?.items || []}
          rowKey={(row) => row.id}
          columns={[
            { key: 'patientCode', header: 'Patient ID' },
            { key: 'patientName', header: 'Name' },
            { key: 'phoneNumber', header: 'Phone' },
            { key: 'department', header: 'Department' },
            { key: 'procedure', header: 'Procedure' },
            { key: 'doctorName', header: 'Doctor' },
            { key: 'formDate', header: 'Date' },
            { key: 'bookingStatus', header: 'Booking' },
          ]}
        />
        <Pagination meta={report?.meta} onPage={(page) => setQuery({ ...query, page })} />
      </div>
    </div>
  );
}
