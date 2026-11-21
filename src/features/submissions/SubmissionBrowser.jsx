import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { formatWhen } from '../../utils/format.js';
import { Badge, Button, PageHeader, RecordState, statusTone, TextInput } from '../../components/common/ui.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import { Pagination } from '../../components/common/ui.jsx';
import { useApiQuery, useDebouncedValue, usePagedQuery, useQueryError } from '../../services/query.js';

export default function SubmissionBrowser({ title, endpoint, basePath, doctorMode = false }) {
  const navigate = useNavigate();
  const departments = useSelector((state) => state.auth.user?.departments || []);
  const departmentOptions = doctorMode && departments.length
    ? departments
    : [{ code: 'SKIN', name: 'Skin' }, { code: 'SURGERY', name: 'Surgery' }];
  const [query, setQuery] = useState({ page: 1, limit: 10, search: '', departmentCode: '', bookingStatus: '', dateFrom: '', dateTo: '', consultationStatus: '' });
  const search = useDebouncedValue(query.search);
  const params = useMemo(() => Object.fromEntries(Object.entries({ ...query, search }).filter(([, value]) => value)), [query, search]);
  const list = usePagedQuery(['submissions', endpoint, params], endpoint, params);
  const doctorList = useApiQuery(['directory-doctors'], '/directory/doctors', { limit: '100' }, { enabled: !doctorMode, staleTime: 5 * 60_000 });
  const procedureList = useApiQuery(['procedures', 'active'], '/procedures', { active: 'true' }, { enabled: !doctorMode, staleTime: 5 * 60_000 });
  useQueryError(list.error);
  const result = list.data;
  const doctors = doctorList.data?.data || [];
  const procedures = procedureList.data?.data || [];

  return (
    <div>
      <PageHeader title={title} text={doctorMode ? 'Booked patients assigned to you. A visit appears here after the clinic marks it booked.' : 'Search and filter live submissions.'} />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
        <TextInput placeholder="Name, phone, or ID" value={query.search} onChange={(event) => setQuery({ ...query, page: 1, search: event.target.value })} />
        <select className="field" value={query.departmentCode} onChange={(event) => setQuery({ ...query, page: 1, departmentCode: event.target.value })}>
          <option value="">{doctorMode ? 'My departments' : 'All departments'}</option>
          {departmentOptions.map((department) => <option key={department.code} value={department.code}>{department.name || department.code}</option>)}
        </select>
        {!doctorMode && (
          <select className="field" value={query.doctorId || ''} onChange={(event) => setQuery({ ...query, page: 1, doctorId: event.target.value })}>
            <option value="">All doctors</option>
            {doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
          </select>
        )}
        {!doctorMode && (
          <select className="field" value={query.procedureId || ''} onChange={(event) => setQuery({ ...query, page: 1, procedureId: event.target.value })}>
            <option value="">All procedures</option>
            {procedures.map((procedure) => <option key={procedure._id} value={procedure._id}>{procedure.departmentCode}: {procedure.name}</option>)}
          </select>
        )}
        {!doctorMode && (
          <select className="field" value={query.bookingStatus} onChange={(event) => setQuery({ ...query, page: 1, bookingStatus: event.target.value })}>
            <option value="">Any booking</option>
            <option value="BOOKED">Booked</option>
            <option value="NOT_BOOKED">Not booked</option>
          </select>
        )}
        {doctorMode && (
          <select className="field" value={query.consultationStatus} onChange={(event) => setQuery({ ...query, page: 1, consultationStatus: event.target.value })}>
            <option value="">Any consultation</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
          </select>
        )}
        <TextInput type="date" value={query.dateFrom} onChange={(event) => setQuery({ ...query, page: 1, dateFrom: event.target.value })} />
        <TextInput type="date" value={query.dateTo} onChange={(event) => setQuery({ ...query, page: 1, dateTo: event.target.value })} />
        <Button variant="secondary" onClick={() => setQuery({ page: 1, limit: 10, search: '', departmentCode: '', bookingStatus: '', dateFrom: '', dateTo: '', consultationStatus: '' })}>Clear</Button>
      </div>
      <div className="card p-4">
        <DataTable
          loading={list.isPending}
          rows={result?.items || []}
          rowKey={(row) => row.id}
          onRow={(row) => navigate(`${basePath}/${row.id}`)}
          emptyTitle={doctorMode ? 'No patients assigned' : 'No submissions'}
          emptyText={doctorMode ? 'Booked patients assigned to you show up here.' : 'Adjust the filters or register a patient.'}
          columns={[
            { key: 'unread', header: 'Record', render: (row) => <RecordState unread={row.unread} /> },
            { key: 'patientCode', header: 'Patient ID' },
            { key: 'patientName', header: 'Name' },
            { key: 'phoneNumber', header: 'Phone' },
            { key: 'department', header: 'Department' },
            { key: 'procedure', header: 'Procedure' },
            { key: 'doctorName', header: 'Doctor' },
            { key: 'formDate', header: 'Date', render: (row) => row.formDate },
            { key: 'bookingStatus', header: 'Booking', render: (row) => <Badge tone={statusTone(row.bookingStatus)}>{row.bookingStatus.replaceAll('_', ' ')}</Badge> },
            ...(doctorMode ? [{ key: 'consultationStatus', header: 'Consultation', render: (row) => <Badge tone={statusTone(row.consultationStatus)}>{row.consultationStatus}</Badge> }] : []),
            { key: 'createdAt', header: 'Submitted', render: (row) => formatWhen(row.createdAt) },
          ]}
        />
        <Pagination meta={result?.meta} onPage={(page) => setQuery({ ...query, page })} />
      </div>
    </div>
  );
}
