import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { errorMessage } from '../../utils/format.js';
import { PageHeader, TextInput, useToast } from '../../components/common/ui.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import { Pagination } from '../../components/common/ui.jsx';

export default function PatientBrowser({ basePath }) {
  const toast = useToast();
  const [query, setQuery] = useState({ page: 1, search: '', departmentCode: '' });
  const [result, setResult] = useState(null);
  useEffect(() => {
    const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value));
    api.get('/patients', params).then(setResult).catch((error) => toast.error(errorMessage(error)));
  }, [query, toast]);
  return (
    <div>
      <PageHeader title="Patients" text="Department IDs stay with the person. A shared phone number never merges two people." />
      <div className="card mb-4 grid gap-3 p-4 md:grid-cols-3">
        <TextInput placeholder="Name, phone, or ID" value={query.search} onChange={(event) => setQuery({ ...query, page: 1, search: event.target.value })} />
        <select className="field" value={query.departmentCode} onChange={(event) => setQuery({ ...query, page: 1, departmentCode: event.target.value })}>
          <option value="">All departments</option>
          <option value="SKIN">Skin</option>
          <option value="SURGERY">Surgery</option>
        </select>
      </div>
      <div className="card p-4">
        <DataTable
          rows={result?.items || []}
          rowKey={(row) => row.id}
          columns={[
            { key: 'patientCode', header: 'Patient ID', render: (row) => <Link className="font-medium text-brand-700" to={`${basePath}/${row.id}`}>{row.patientCode}</Link> },
            { key: 'fullName', header: 'Name' },
            { key: 'contactNumber', header: 'Phone' },
            { key: 'cnicMasked', header: 'CNIC' },
            { key: 'departmentCode', header: 'Department' },
            { key: 'gender', header: 'Gender' },
          ]}
        />
        <Pagination meta={result?.meta} onPage={(page) => setQuery({ ...query, page })} />
      </div>
    </div>
  );
}
