import { UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { errorMessage, formatWhen, roleLabel } from '../../utils/format.js';
import { Badge, Button, Field, Modal, PageHeader, TextArea, TextInput, useToast } from '../../components/common/ui.jsx';
import PasswordField from '../../pages/auth/PasswordField.jsx';
import DataTable from '../../components/tables/DataTable.jsx';

function useLoad(loader, deps = []) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    loader().then((body) => { if (active) setData(body); }).catch((error) => { if (active) toast.error(errorMessage(error)); });
    return () => { active = false; };
  }, [version, ...deps]);
  return { data, reload: () => setVersion((value) => value + 1), toast };
}

export function UserAdmin({ role, title }) {
  const { data, reload, toast } = useLoad(() => api.get('/users', role ? { role, limit: '100' } : { limit: '100' }), [role]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', email: '', phone: '', role: role || 'ADMIN', departments: [] });
  const [fieldErrors, setFieldErrors] = useState({});
  const accountRole = role || form.role;
  const usesContactForm = accountRole === 'ADMIN' || accountRole === 'DOCTOR' || accountRole === 'CLINIC_MANAGER';
  const isDoctor = accountRole === 'DOCTOR';
  useEffect(() => { api.get('/departments').then((body) => setDepartments(body.data)).catch(() => {}); }, []);

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
          rows={(data?.items || []).filter((row) => !role || row.role === role)}
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
                  try { await api.patch(`/users/${row.id}`, { isActive: !row.isActive }); reload(); }
                  catch (error) { toast.error(errorMessage(error)); }
                }}>{row.isActive ? 'Deactivate' : 'Activate'}</Button>
              </div>
            ) },
          ]}
        />
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
  const { data, reload, toast } = useLoad(() => api.get('/departments'));
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
  const { data, reload, toast } = useLoad(() => api.get('/procedures'));
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({ name: '', departmentId: '', description: '' });
  useEffect(() => { api.get('/departments').then((body) => setDepartments(body.data)).catch(() => {}); }, []);
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

export function MasterDataAdmin() {
  const { data: typesBody } = useLoad(() => api.get('/master-data/types'));
  const [type, setType] = useState('OCCUPATION');
  const { data, reload, toast } = useLoad(() => api.get('/master-data', { type }), [type]);
  const [label, setLabel] = useState('');
  const types = typesBody?.data || [];
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <aside className="card p-3">
        {types.map((item) => (
          <button key={item.type} type="button" onClick={() => setType(item.type)} className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${type === item.type ? 'bg-teal-50 text-teal-900' : 'text-slate-600'}`}>
            {item.label}
          </button>
        ))}
      </aside>
      <div>
        <PageHeader title={types.find((item) => item.type === type)?.label || 'Master data'} text={types.find((item) => item.type === type)?.description} />
        <form className="card mb-4 flex flex-col gap-2 p-4 sm:flex-row" onSubmit={async (event) => {
          event.preventDefault();
          try {
            await api.post('/master-data', { type, label, allowOther: label.toLowerCase() === 'other', metadata: type === 'SKIN_FIELD' ? { inputType: 'text', required: false, pendingConfirmation: true } : {} });
            setLabel('');
            reload();
          } catch (error) { toast.error(errorMessage(error)); }
        }}>
          <TextInput placeholder="New option" value={label} onChange={(event) => setLabel(event.target.value)} required />
          <Button type="submit">Add</Button>
        </form>
        <div className="card p-4">
          <DataTable rows={(data?.data || []).filter((item) => item.type === type)} rowKey={(row) => row._id} columns={[
            { key: 'label', header: 'Label' },
            { key: 'value', header: 'Value' },
            { key: 'isActive', header: '', render: (row) => <Button size="sm" variant="secondary" onClick={async () => { await api.patch(`/master-data/${row._id}`, { isActive: !row.isActive }); reload(); }}>{row.isActive ? 'Deactivate' : 'Activate'}</Button> },
          ]} />
        </div>
      </div>
    </div>
  );
}

export function PolicyAdmin() {
  const { data, reload, toast } = useLoad(() => api.get('/policy/versions'));
  const [items, setItems] = useState('');
  return (
    <div className="space-y-4">
      <PageHeader title="Policy acknowledgement" text="Publishing creates a new version. Earlier versions stay attached to the submissions that acknowledged them." />
      <form className="card space-y-3 p-5" onSubmit={async (event) => {
        event.preventDefault();
        try {
          await api.post('/policy/versions', { items: items.split('\n').map((line) => line.trim()).filter(Boolean) });
          toast.success('Policy version published');
          setItems('');
          reload();
        } catch (error) { toast.error(errorMessage(error)); }
      }}>
        <Field label="New version, one line per point"><TextArea value={items} onChange={(event) => setItems(event.target.value)} /></Field>
        <Button type="submit">Publish version</Button>
      </form>
      <div className="space-y-3">
        {(data?.data || []).map((version) => (
          <article key={version._id} className="card p-4">
            <h3 className="font-bold">Version {version.version}</h3>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">{version.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        ))}
      </div>
    </div>
  );
}

export function AuditScreen() {
  const { data } = useLoad(() => api.get('/audit-logs', { limit: '50' }));
  return (
    <div>
      <PageHeader title="Audit logs" text="Clinical and operational changes are append-only." />
      <div className="card p-4">
        <DataTable rows={data?.items || []} rowKey={(row) => row._id} columns={[
          { key: 'createdAt', header: 'When', render: (row) => formatWhen(row.createdAt) },
          { key: 'userName', header: 'User' },
          { key: 'userRole', header: 'Role' },
          { key: 'action', header: 'Action' },
          { key: 'entityType', header: 'Entity' },
        ]} />
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const { data, toast } = useLoad(() => api.get('/settings'));
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
