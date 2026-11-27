import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { formatWhen } from '../../utils/format.js';
import { Badge, PageHeader, RecordState, Spinner } from '../../components/common/ui.jsx';
import DataTable from '../../components/tables/DataTable.jsx';
import { useApiQuery, useQueryError } from '../../services/query.js';

export default function FormsNeedAttention() {
  const navigate = useNavigate();
  const role = useSelector((state) => state.auth.user?.role);
  const basePath = role === 'ADMIN' ? '/admin/submissions' : '/manager/submissions';
  const inbox = useApiQuery(['alerts', role, 'attention'], '/inbox', undefined, {
    enabled: Boolean(role),
    staleTime: 0,
    placeholderData: (previous) => previous,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });
  useQueryError(inbox.error);
  const items = inbox.data?.data?.items || [];
  const unread = inbox.data?.data?.unread || 0;

  if (inbox.isPending && !inbox.data) return <Spinner label="Loading forms that need attention" />;

  return (
    <div>
      <PageHeader
        title="Forms need attention"
        text="Newly submitted forms that nobody on your account has opened yet."
      />
      <div className="card mb-4 p-4">
        <p className="text-base font-bold text-slate-600">
          {unread > 0 ? `${unread} form${unread === 1 ? '' : 's'} waiting to be reviewed.` : 'All submitted forms have been opened.'}
        </p>
      </div>
      <div className="card p-4">
        <DataTable
          rows={items}
          rowKey={(row) => row.submissionId || row.id}
          onRow={(row) => navigate(`${basePath}/${row.submissionId || row.id}`)}
          emptyTitle="Nothing needs attention"
          emptyText="When a new patient form is submitted, it appears here until you open it."
          columns={[
            { key: 'unread', header: 'Record', render: () => <RecordState unread /> },
            { key: 'patientCode', header: 'Patient ID' },
            { key: 'patientName', header: 'Name' },
            {
              key: 'departmentCode',
              header: 'Department',
              render: (row) => <Badge tone="teal">{row.departmentCode === 'SKIN' ? 'Skin' : 'Surgery'}</Badge>,
            },
            { key: 'createdAt', header: 'Submitted', render: (row) => formatWhen(row.createdAt) },
          ]}
        />
      </div>
    </div>
  );
}
