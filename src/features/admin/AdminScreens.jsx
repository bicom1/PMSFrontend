import { UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '../../services/query.js';
import { api } from '../../services/api.js';
import { errorMessage, formatWhen, roleLabel } from '../../utils/format.js';
import { Badge, Button, Field, Modal, PageHeader, Pagination, TextArea, TextInput, useToast } from '../../components/common/ui.jsx';
import PasswordField from '../../pages/auth/PasswordField.jsx';
import DataTable from '../../components/tables/DataTable.jsx';

function useLoad(queryKey, loader, { paged = false } = {}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => loader(signal),
    placeholderData: paged ? keepPreviousData : undefined,
  });
  useEffect(() => {
    if (query.error) toast.error(errorMessage(query.error));
  }, [query.error, toast]);
  return { data: query.data, reload: () => queryClient.invalidateQueries({ queryKey }), toast };
}

export function UserAdmin({ role, title }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [role]);
  const { data, reload, toast } = useLoad(['users', role || 'all', page], () => api.get('/users', { ...(role ? { role } : {}), page, limit: 10 }), { paged: true });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const departmentQuery = useApiQuery(['departments'], '/departments', undefined, { staleTime: 5 * 60_000 });
  const departments = departmentQuery.data?.data || [];
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '', phone: '', role: role || 'ADMIN', departments: [] });
  const [fieldErrors, setFieldErrors] = useState({});
  const accountRole = role || form.role;
  const usesContactForm = accountRole === 'ADMIN' || accountRole === 'DOCTOR' || accountRole === 'CLINIC_MANAGER';
  const isDoctor = accountRole === 'DOCTOR';

  function refreshDoctorLists() {
    queryClient.invalidateQueries({ queryKey: ['directory-doctors'] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
  }

  async function create(event) {
    event.preventDefault();
    const nextErrors = {};
    if (form.fullName.trim().length < 2) nextErrors.fullName = 'Name must be at least 2 characters';
    if (usesContactForm) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email';
      if (!/^[0-9+\-\s()]{7,20}$/.test(form.phone.trim())) nextErrors.phone = 'Enter a valid contact number';
      if (isDoctor && !form.departments.length) nextErrors.departments = 'Select Skin, Surgery, or both';
    } else if (!/^[a-zA-Z0-9._]{3,30}$/.test(form.username.trim())) {
      nextErrors.username = 'Username must be 3-30 letters, numbers, dots, or underscores';
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/.test(form.password)) {
      nextErrors.password = 'Password must be 8-64 characters and include an uppercase letter, a lowercase letter, and a number';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      await api.post('/users', {
        fullName: form.fullName.trim(),
        password: form.password,
        role: accountRole,
        departments: isDoctor ? form.departments : [],
        ...(usesContactForm
          ? { email: form.email.trim(), phone: form.phone.trim() }
          : { username: form.username.trim() }),
      });
      toast.success('Account created');
      setForm({ username: '', password: '', fullName: '', email: '', phone: '', role: role || 'ADMIN', departments: [] });
      setFieldErrors({});
      setOpen(false);
      reload();
      if (isDoctor) refreshDoctorLists();
    } catch (error) { toast.error(errorMessage(error)); }
  }

  async function saveEdit(event) {
    event.preventDefault();
    try {
      await api.patch(`/users/${editing.id}`, {
        fullName: editing.fullName.trim(),
        email: editing.email.trim(),
        phone: editing.phone.trim(),
        ...(editing.role === 'DOCTOR' ? { departments: editing.departments } : {}),
      });
      toast.success('Account updated');
      setEditing(null);
      reload();
      if (editing.role === 'DOCTOR') refreshDoctorLists();
    } catch (error) { toast.error(errorMessage(error)); }
  }

  const intro = role === 'DOCTOR'
    ? 'Doctors sign in with email and password. Assign Skin, Surgery, or both.'
    : role === 'CLINIC_MANAGER'
      ? 'Clinic managers sign in with email and password. They are separate from doctors.'
      : 'Only an administrator can create another administrator, a clinic manager, or a doctor.';
  const addLabel = role === 'DOCTOR' ? 'Add doctor' : role === 'CLINIC_MANAGER' ? 'Add clinic manager' : 'New account';

  return (
    <div>
      <PageHeader title={title} text={intro} actions={<Button onClick={() => setOpen(true)}><UserPlus size={18} /> {addLabel}</Button>} />
      <div className="card p-4">
        <DataTable
          rows={data?.items || []}
          rowKey={(row) => row.id}
          columns={[
            { key: 'fullName', header: 'Name' },
            ...(usesContactForm || !role
              ? [
                { key: 'email', header: 'Email', render: (row) => row.email || '—' },
                { key: 'phone', header: 'Contact number', render: (row) => row.phone || '—' },
              ]
              : [{ key: 'username', header: 'Username' }]),
            { key: 'role', header: 'Role', render: (row) => roleLabel(row.role) },
            ...(role === 'CLINIC_MANAGER' ? [] : [{ key: 'departments', header: 'Departments', render: (row) => row.departments.map((item) => item.code).join(', ') || '—' }]),
            { key: 'isActive', header: 'Status', render: (row) => <Badge tone={row.isActive ? 'green' : 'rose'}>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
            { key: 'actions', header: '', render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing({
                  id: row.id,
                  fullName: row.fullName || '',
                  email: row.email || '',
                  phone: row.phone || '',
                  role: row.role,
                  departments: (row.departments || []).map((item) => String(item.id)),
                })}>Edit</Button>
                <Button size="sm" variant="secondary" onClick={async () => {
                  const password = window.prompt('Temporary password');
                  if (!password) return;
                  try { await api.post(`/users/${row.id}/reset-password`, { password }); toast.success('Password reset'); }
                  catch (error) { toast.error(errorMessage(error)); }
                }}>Reset</Button>
                <Button size="sm" variant={row.isActive ? 'danger' : 'secondary'} onClick={async () => {
                  try {
                    await api.patch(`/users/${row.id}`, { isActive: !row.isActive });
                    reload();
                    if (row.role === 'DOCTOR') refreshDoctorLists();
                  } catch (error) { toast.error(errorMessage(error)); }
                }}>{row.isActive ? 'Deactivate' : 'Activate'}</Button>
              </div>
            ) },
          ]}
        />
        <Pagination meta={data?.meta} onPage={setPage} />
      </div>
      <Modal open={open} title={isDoctor ? 'Add doctor' : accountRole === 'CLINIC_MANAGER' ? 'Add clinic manager' : 'Add administrator'} onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={create}>
          <Field label="Name" error={fieldErrors.fullName}><TextInput value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required /></Field>
          {usesContactForm ? (
            <>
              <Field label="Email" error={fieldErrors.email}><TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></Field>
              <Field label="Contact number" error={fieldErrors.phone}><TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} inputMode="tel" required /></Field>
              <PasswordField id="new-account-password" label="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" error={fieldErrors.password} />
            </>
          ) : (
            <>
              <Field label="Username" error={fieldErrors.username}><TextInput value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required /></Field>
              <PasswordField id="new-account-password" label="Password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" error={fieldErrors.password} />
            </>
          )}
          {!role && (
            <Field label="Role">
              <select className="field" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option value="ADMIN">Administrator</option>
                <option value="CLINIC_MANAGER">Clinic manager</option>
                <option value="DOCTOR">Doctor</option>
              </select>
            </Field>
          )}
          {isDoctor && (
            <div className="space-y-2 text-sm">
              {departments.map((department) => {
                const departmentId = String(department._id || department.id);
                return (
                  <label key={departmentId} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-base font-bold">
                    <input type="checkbox" checked={form.departments.includes(departmentId)} onChange={(event) => setForm({ ...form, departments: event.target.checked ? [...form.departments, departmentId] : form.departments.filter((id) => id !== departmentId) })} />
                    {department.name}
                  </label>
                );
              })}
              {fieldErrors.departments && <p className="text-xs text-rose-600">{fieldErrors.departments}</p>}
            </div>
          )}
          <Button type="submit" className="w-full sm:w-auto">Create</Button>
        </form>
      </Modal>
      <Modal open={Boolean(editing)} title="Edit account" onClose={() => setEditing(null)}>
        {editing && (
          <form className="space-y-3" onSubmit={saveEdit}>
            <Field label="Name"><TextInput value={editing.fullName} onChange={(event) => setEditing({ ...editing, fullName: event.target.value })} required /></Field>
            <Field label="Email"><TextInput type="email" value={editing.email} onChange={(event) => setEditing({ ...editing, email: event.target.value })} /></Field>
            <Field label="Contact number"><TextInput value={editing.phone} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} inputMode="tel" /></Field>
            {editing.role === 'DOCTOR' && (
              <div className="space-y-2 text-sm">
                {departments.map((department) => {
                  const departmentId = String(department._id || department.id);
                  return (
                    <label key={departmentId} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-base font-bold">
                      <input type="checkbox" checked={editing.departments.includes(departmentId)} onChange={(event) => setEditing({ ...editing, departments: event.target.checked ? [...editing.departments, departmentId] : editing.departments.filter((id) => id !== departmentId) })} />
                      {department.name}
                    </label>
                  );
                })}
              </div>
            )}
            <Button type="submit" className="w-full sm:w-auto">Save</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

export function DepartmentAdmin() {
  const { data, reload, toast } = useLoad(['departments'], () => api.get('/departments'));
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(null);
  return (
    <div>
      <PageHeader title="Departments" text="Skin and Surgery keep separate patient ID sequences. Names can be edited; codes stay fixed." />
      <div className="grid gap-4 md:grid-cols-2">
        {(data?.data || []).map((department) => (
          <form key={department._id} className="card space-y-3 p-5" onSubmit={async (event) => {
            event.preventDefault();
            try { await api.patch(`/departments/${department._id}`, { name: selected === department._id ? name : department.name, description: department.description }); toast.success('Department updated'); reload(); }
            catch (error) { toast.error(errorMessage(error)); }
          }}>
            <p className="text-xs font-bold text-teal-700">{department.code} · {department.patientIdPrefix}</p>
            <TextInput defaultValue={department.name} onChange={(event) => { setSelected(department._id); setName(event.target.value); }} />
            <Button type="submit" size="sm">Save</Button>
          </form>
        ))}
      </div>
    </div>
  );
}

export function ProcedureAdmin() {
  const { data, reload, toast } = useLoad(['procedures'], () => api.get('/procedures'));
  const departmentQuery = useApiQuery(['departments'], '/departments', undefined, { staleTime: 5 * 60_000 });
  const departments = departmentQuery.data?.data || [];
  const [form, setForm] = useState({ name: '', departmentId: '', description: '' });
  return (
    <div className="space-y-4">
      <PageHeader title="Procedures" text="Procedure names are provisional until the clinic confirms the real list." />
      <form className="card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4" onSubmit={async (event) => {
        event.preventDefault();
        try { await api.post('/procedures', form); toast.success('Procedure added'); reload(); }
        catch (error) { toast.error(errorMessage(error)); }
      }}>
        <TextInput placeholder="Procedure name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <select className="field" value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} required>
          <option value="">Department</option>
          {departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
        </select>
        <TextInput placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <Button type="submit">Add</Button>
      </form>
      <div className="card p-4">
        <DataTable rows={data?.data || []} rowKey={(row) => row._id} columns={[
          { key: 'name', header: 'Name' },
          { key: 'departmentCode', header: 'Department' },
          { key: 'provisional', header: 'Status', render: () => <Badge tone="amber">Provisional</Badge> },
          { key: 'isActive', header: '', render: (row) => <Button size="sm" variant="secondary" onClick={async () => { await api.patch(`/procedures/${row._id}`, { isActive: !row.isActive }); reload(); }}>{row.isActive ? 'Deactivate' : 'Activate'}</Button> },
        ]} />
      </div>
    </div>
  );
}

const FIELD_INPUT_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
];

export function MasterDataAdmin() {
  const queryClient = useQueryClient();
  const { data: typesBody } = useLoad(['master-types'], () => api.get('/master-data/types'));
  const [type, setType] = useState('OCCUPATION');
  const { data, reload, toast } = useLoad(['master-data', type], () => api.get('/master-data', { type }));
  const [label, setLabel] = useState('');
  const [inputType, setInputType] = useState('text');
  const [optionsText, setOptionsText] = useState('');
  const types = typesBody?.data || [];
  const selected = types.find((item) => item.type === type);
  const isCustom = type === 'SKIN_FIELD';

  async function addItem(event) {
    event.preventDefault();
    try {
      const options = optionsText.split('\n').map((line) => line.trim()).filter(Boolean);
      await api.post('/master-data', {
        type,
        label: label.trim(),
        allowOther: label.trim().toLowerCase() === 'other',
        metadata: isCustom
          ? {
            inputType,
            required: false,
            pendingConfirmation: false,
            ...(inputType === 'select' ? { options } : {}),
          }
          : {},
      });
      setLabel('');
      setOptionsText('');
      setInputType('text');
      reload();
      queryClient.invalidateQueries({ queryKey: ['master-data'] });
      toast.success(isCustom ? 'Custom field added' : 'Option added');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="card p-3">
        <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wide text-slate-400">Form fields</p>
        {types.map((item) => (
          <button key={item.type} type="button" onClick={() => setType(item.type)} className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${type === item.type ? 'bg-teal-50 text-teal-900' : 'text-slate-600'}`}>
            {item.label}
          </button>
        ))}
      </aside>
      <div>
        <PageHeader title="Form Management" text={selected?.description || 'Manage the dropdown options and custom fields used on the patient form.'} />
        <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2" onSubmit={addItem}>
          <Field label="Name">
            <TextInput placeholder={isCustom ? 'Field name' : 'Option name'} value={label} onChange={(event) => setLabel(event.target.value)} required />
          </Field>
          <Field label="Type">
            {isCustom ? (
              <select className="field" value={inputType} onChange={(event) => setInputType(event.target.value)}>
                {FIELD_INPUT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            ) : (
              <TextInput value={selected?.label || type} readOnly />
            )}
          </Field>
          {isCustom && inputType === 'select' && (
            <div className="sm:col-span-2">
              <Field label="Dropdown options">
                <TextArea placeholder={'One option per line\nMild\nModerate\nSevere'} value={optionsText} onChange={(event) => setOptionsText(event.target.value)} />
              </Field>
            </div>
          )}
          <div className="sm:col-span-2">
            <Button type="submit">{isCustom ? 'Add custom field' : 'Add option'}</Button>
          </div>
        </form>
        <div className="card p-4">
          <DataTable rows={(data?.data || []).filter((item) => item.type === type)} rowKey={(row) => row._id} columns={[
            { key: 'label', header: 'Name' },
            ...(isCustom
              ? [{ key: 'inputType', header: 'Type', render: (row) => FIELD_INPUT_TYPES.find((item) => item.value === row.metadata?.inputType)?.label || row.metadata?.inputType || 'Text' }]
              : [{ key: 'value', header: 'Value' }]),
            { key: 'isActive', header: '', render: (row) => <Button size="sm" variant="secondary" onClick={async () => { await api.patch(`/master-data/${row._id}`, { isActive: !row.isActive }); reload(); queryClient.invalidateQueries({ queryKey: ['master-data'] }); }}>{row.isActive ? 'Deactivate' : 'Activate'}</Button> },
          ]} />
        </div>
      </div>
    </div>
  );
}

export function PolicyAdmin() {
  const [departmentCode, setDepartmentCode] = useState('SKIN');
  const { data, reload, toast } = useLoad(['policy-versions', departmentCode], () => api.get('/policy/versions', { departmentCode }));
  const [items, setItems] = useState('');
  const label = departmentCode === 'SKIN' ? 'Skin' : 'Surgery';
  return (
    <div className="space-y-4">
      <PageHeader title="Policy acknowledgement" text="Skin and Surgery each have their own policy. Publishing updates the acknowledgement text for that department. Earlier acknowledgements stay attached to the submissions that already used them." />
      <div className="flex flex-wrap gap-2">
        {['SKIN', 'SURGERY'].map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => { setDepartmentCode(code); setItems(''); }}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition ${departmentCode === code ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {code === 'SKIN' ? 'Skin policy' : 'Surgery policy'}
          </button>
        ))}
      </div>
      <form className="card space-y-3 p-5" onSubmit={async (event) => {
        event.preventDefault();
        try {
          await api.post('/policy/versions', {
            departmentCode,
            items: items.split('\n').map((line) => line.trim()).filter(Boolean),
          });
          toast.success(`${label} policy published`);
          setItems('');
          reload();
        } catch (error) { toast.error(errorMessage(error)); }
      }}>
        <Field label={`${label} — one line per point`}>
          <TextArea value={items} onChange={(event) => setItems(event.target.value)} placeholder={'All fees should be paid before the start of the procedure.\nTake the invoice from the counter on the 3rd floor.'} />
        </Field>
        <Button type="submit">Publish {label.toLowerCase()} policy</Button>
      </form>
      <div className="space-y-3">
        {(data?.data || []).map((version) => (
          <article key={version._id} className="card p-4">
            <h3 className="font-bold">{label} · Published {new Date(version.createdAt).toLocaleString()}</h3>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">{version.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        ))}
      </div>
    </div>
  );
}

const AUDIT_ACTIONS = [
  ['PATIENT_CREATED', 'Patient created'],
  ['PATIENT_UPDATED', 'Patient updated'],
  ['PATIENT_IDENTITY_LINKED', 'Patient linked across departments'],
  ['PATIENT_MERGED', 'Duplicate patient merged'],
  ['FORM_SUBMITTED', 'Form submitted'],
  ['BOOKING_STATUS_CHANGED', 'Booking status changed'],
  ['DOCTOR_REASSIGNED', 'Doctor reassigned'],
  ['OPERATIONAL_REMARK_UPDATED', 'Operational remark updated'],
  ['CONSULTATION_STATUS_CHANGED', 'Consultation status changed'],
  ['DOCUMENT_UPLOADED', 'Document uploaded'],
  ['DOCUMENT_VIEWED', 'Document viewed'],
  ['DOCUMENT_DOWNLOADED', 'Document downloaded'],
  ['DOCUMENT_DELETED', 'Document deleted'],
  ['MEDICAL_HISTORY_DOWNLOADED', 'Medical history downloaded'],
  ['PRESCRIPTION_CREATED', 'Prescription created'],
  ['PRESCRIPTION_VERSIONED', 'Prescription version saved'],
  ['CLINICAL_REMARK_CREATED', 'Clinical remark created'],
  ['CLINICAL_REMARK_VERSIONED', 'Clinical remark version saved'],
  ['USER_CREATED', 'Account created'],
  ['USER_UPDATED', 'Account updated'],
  ['USER_DEACTIVATED', 'Account deactivated'],
  ['USER_REACTIVATED', 'Account reactivated'],
  ['PASSWORD_RESET', 'Password reset'],
  ['PASSWORD_CHANGED', 'Password changed'],
  ['MASTER_DATA_CHANGED', 'Master data changed'],
  ['PROCEDURE_CHANGED', 'Procedure changed'],
  ['DEPARTMENT_UPDATED', 'Department updated'],
  ['POLICY_CHANGED', 'Policy changed'],
  ['SETTINGS_CHANGED', 'Settings changed'],
];

const AUDIT_LABELS = Object.fromEntries(AUDIT_ACTIONS);

function auditText(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).replaceAll('_', ' ');
}

function changeSummary(row) {
  const next = row.newValue && typeof row.newValue === 'object' ? row.newValue : {};
  const previous = row.previousValue && typeof row.previousValue === 'object' ? row.previousValue : {};
  const parts = [
    next.patientCode || previous.patientCode,
    next.fullName || previous.fullName,
    next.filename,
    next.bookingStatus && `Booking ${String(next.bookingStatus).replaceAll('_', ' ').toLowerCase()}`,
    next.doctorName && `Doctor ${next.doctorName}`,
    next.consultationStatus && `Consultation ${next.consultationStatus}`,
    next.reason,
    next.version && `Policy update`,
  ].filter(Boolean);
  return parts.join(' · ') || row.entityType || '—';
}

export function AuditScreen() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState(null);
  const params = { page, limit: 20, ...(action ? { action } : {}), ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
  const { data } = useLoad(['audit', page, action, dateFrom, dateTo], () => api.get('/audit-logs', params), { paged: true });
  return (
    <div>
      <PageHeader title="Audit logs" text="Who changed what, and when. Only an administrator can open this record. Entries cannot be edited or deleted." />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <select className="field" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }}>
          <option value="">All activities</option>
          {AUDIT_ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <TextInput type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} aria-label="From date" />
        <TextInput type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} aria-label="To date" />
        <Button variant="secondary" onClick={() => { setAction(''); setDateFrom(''); setDateTo(''); setPage(1); }}>Clear</Button>
      </div>
      <div className="card p-4">
        <DataTable
          rows={data?.items || []}
          rowKey={(row) => row._id}
          emptyTitle="No audit entries"
          emptyText="Create, update, booking, document, and clinical actions will appear here."
          columns={[
            { key: 'createdAt', header: 'When', render: (row) => formatWhen(row.createdAt) },
            { key: 'userName', header: 'Who', render: (row) => `${row.userName} · ${roleLabel(row.userRole)}` },
            { key: 'action', header: 'Activity', render: (row) => AUDIT_LABELS[row.action] || row.action },
            { key: 'summary', header: 'What changed', render: (row) => changeSummary(row) },
            { key: 'details', header: '', render: (row) => <Button size="sm" variant="secondary" onClick={() => setSelected(row)}>Details</Button> },
          ]}
        />
        <Pagination meta={data?.meta} onPage={setPage} />
      </div>
      <Modal open={Boolean(selected)} title={selected ? (AUDIT_LABELS[selected.action] || selected.action) : 'Audit entry'} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4 text-sm">
            <p className="font-bold text-slate-600">{selected.userName} · {roleLabel(selected.userRole)} · {formatWhen(selected.createdAt)}</p>
            <p className="font-bold text-ink-900">{changeSummary(selected)}</p>
            {[['Previous', selected.previousValue], ['New', selected.newValue]].map(([title, value]) => (
              <div key={title}>
                <p className="font-bold text-ink-900">{title}</p>
                {value && typeof value === 'object' && Object.keys(value).length > 0 ? (
                  <dl className="mt-2 space-y-1">
                    {Object.entries(value).map(([key, item]) => (
                      <div key={key} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
                        <dt className="font-bold text-slate-400">{key}</dt>
                        <dd className="break-words font-bold text-slate-800">{auditText(item)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : <p className="mt-1 font-bold text-slate-500">No stored value.</p>}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function SettingsScreen() {
  const { data, toast } = useLoad(['settings'], () => api.get('/settings'));
  const [form, setForm] = useState(null);
  useEffect(() => { if (data?.data) setForm(data.data); }, [data]);
  if (!form) return null;
  return (
    <form className="mx-auto max-w-xl space-y-4" onSubmit={async (event) => {
      event.preventDefault();
      try { await api.patch('/settings', form); toast.success('Settings saved'); }
      catch (error) { toast.error(errorMessage(error)); }
    }}>
      <PageHeader title="Settings" text="Clinic profile used on prescriptions and the sign-in experience." />
      <div className="card space-y-3 p-5">
        <Field label="Clinic name"><TextInput value={form.clinicName} onChange={(event) => setForm({ ...form, clinicName: event.target.value })} /></Field>
        <Field label="Phone"><TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
        <Field label="Address"><TextInput value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.skinFormConfirmed} onChange={(event) => setForm({ ...form, skinFormConfirmed: event.target.checked })} />Skin form confirmed by the clinic</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.surgeryOptionsConfirmed} onChange={(event) => setForm({ ...form, surgeryOptionsConfirmed: event.target.checked })} />Surgery options confirmed by the clinic</label>
        <Button type="submit">Save settings</Button>
      </div>
    </form>
  );
}
