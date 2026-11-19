import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api.js';
import { errorMessage, formatWhen } from '../../utils/format.js';
import { Badge, Button, PageHeader, RecordState, Spinner, TextInput, statusTone, useToast } from '../../components/common/ui.jsx';
import { Pagination } from '../../components/common/ui.jsx';

function factsOf(patient) {
  return [
    ['Patient ID', patient.patientCode],
    ['Name', patient.fullName],
    ['Phone', patient.contactNumber],
    ['CNIC', patient.cnic || patient.cnicMasked],
    ['Department', patient.departmentCode],
    ['Gender', patient.gender],
    ['Date of birth', patient.dateOfBirth],
    ['Age', patient.age],
    ['Nationality', patient.nationality],
    ['Occupation', patient.occupationOther || patient.occupation],
    ['City', patient.city],
    ['Address', patient.address],
    ['Registered', formatWhen(patient.createdAt)],
  ];
}

function FactGrid({ patient }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {factsOf(patient).map(([label, value]) => (
        <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
          <dd className="mt-1 text-sm font-bold text-ink-900">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function PatientBrowser({ basePath }) {
  const toast = useToast();
  const [query, setQuery] = useState({ page: 1, search: '', departmentCode: '' });
  const [result, setResult] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value));
    api.get('/patients', params).then(setResult).catch((error) => toast.error(errorMessage(error)));
  }, [query, toast]);

  async function openPatient(row) {
    setSelected(row);
    setDetail(null);
    setVisits([]);
    setLoadingDetail(true);
    try {
      const body = await api.get(`/patients/${row.id}`);
      setDetail(body.data);
      setResult((current) => (current?.items ? { ...current, items: current.items.map((item) => (item.id === row.id ? { ...item, unread: false } : item)) } : current));
      setHovered((current) => (current?.id === row.id ? { ...current, unread: false } : current));
      setSelected((current) => (current?.id === row.id ? { ...current, unread: false } : current));
      const submissions = await api.get('/submissions', { patientCode: body.data.patient.patientCode, limit: '50' });
      setVisits(submissions.items || []);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingDetail(false);
    }
  }

  const preview = hovered;
  const rows = result?.items || [];

  return (
    <div>
      <PageHeader title="Patients" text="Tap a row to open the full record. On a large screen, hover for a quick view." />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2">
        <TextInput placeholder="Name, phone, or ID" value={query.search} onChange={(event) => setQuery({ ...query, page: 1, search: event.target.value })} />
        <select className="field" value={query.departmentCode} onChange={(event) => setQuery({ ...query, page: 1, departmentCode: event.target.value })}>
          <option value="">All departments</option>
          <option value="SKIN">Skin</option>
          <option value="SURGERY">Surgery</option>
        </select>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card p-4">
          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <button key={row.id} type="button" className={`w-full rounded-2xl border border-slate-200 p-4 text-left ${row.unread ? 'bg-rose-50/80' : 'bg-slate-50'}`} onClick={() => openPatient(row)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-lg font-bold text-ink-900">{row.fullName}</p>
                    <p className="text-base font-bold text-brand-700">{row.patientCode}</p>
                  </div>
                  <RecordState unread={row.unread} />
                </div>
                <dl className="mt-3 space-y-1 text-base">
                  <div className="flex justify-between gap-3"><dt className="text-slate-400">Phone</dt><dd className="font-bold">{row.contactNumber || '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-400">CNIC</dt><dd className="font-bold">{row.cnicMasked || '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-400">Department</dt><dd className="font-bold">{row.departmentCode || '—'}</dd></div>
                </dl>
              </button>
            ))}
            {rows.length === 0 && <p className="px-2 py-8 text-center text-base font-bold text-slate-500">No patients match this search.</p>}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-base">
              <thead className="border-b border-slate-200 text-sm font-bold uppercase tracking-wide text-slate-600">
                <tr>
                  {['Record', 'Patient ID', 'Name', 'Phone', 'CNIC', 'Department', 'Gender'].map((header) => <th key={header} className="whitespace-nowrap px-3 py-3 font-bold">{header}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`cursor-pointer border-b border-slate-100 transition duration-150 ${row.unread ? 'bg-rose-50/80' : ''} ${hovered?.id === row.id || selected?.id === row.id ? 'bg-teal-50' : 'hover:bg-teal-50/70'}`}
                    onMouseEnter={() => setHovered(row)}
                    onClick={() => openPatient(row)}
                  >
                    <td className="px-3 py-3"><RecordState unread={row.unread} /></td>
                    <td className="px-3 py-3 font-bold text-brand-700">{row.patientCode}</td>
                    <td className="px-3 py-3">{row.fullName}</td>
                    <td className="px-3 py-3">{row.contactNumber}</td>
                    <td className="px-3 py-3">{row.cnicMasked}</td>
                    <td className="px-3 py-3">{row.departmentCode}</td>
                    <td className="px-3 py-3">{row.gender}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">No patients match this search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination meta={result?.meta} onPage={(page) => setQuery({ ...query, page })} />
        </div>
        <aside className="card sticky top-20 hidden p-5 lg:block">
          {preview ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{preview.departmentCode}</p>
              <h2 className="mt-1 text-2xl font-bold text-ink-900">{preview.fullName}</h2>
              <div className="mt-2"><RecordState unread={preview.unread} /></div>
              <p className="text-base font-bold text-slate-600">{preview.patientCode}</p>
              <div className="mt-4">
                <FactGrid patient={preview} />
              </div>
              <Button className="mt-4 w-full" onClick={() => openPatient(preview)}>Open full record</Button>
            </div>
          ) : (
            <p className="text-base font-bold text-slate-600">Hover a patient to see their details here.</p>
          )}
        </aside>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink-950/40" onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-xl overflow-auto bg-white p-4 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{(detail?.patient || selected).departmentCode}</p>
                <h2 className="mt-1 break-words text-2xl font-bold text-ink-900 sm:text-3xl">{(detail?.patient || selected).fullName}</h2>
                <div className="mt-2"><RecordState unread={selected.unread} /></div>
                <p className="text-slate-500">{(detail?.patient || selected).patientCode}</p>
              </div>
              <button type="button" className="rounded-lg px-3 py-2 text-base font-bold text-slate-600 hover:bg-slate-100" onClick={() => setSelected(null)}>Close</button>
            </div>
            {loadingDetail && <div className="mt-6"><Spinner label="Loading patient" /></div>}
            {detail && (
              <div className="mt-6 space-y-5">
                {detail.linked && <p className="rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">Linked {detail.linked.departmentCode} record {detail.linked.patientCode}</p>}
                <FactGrid patient={detail.patient} />
                <section>
                  <h3 className="text-lg font-bold">Visits</h3>
                  <div className="mt-3 space-y-2">
                    {visits.length === 0 && <p className="text-base font-bold text-slate-600">No visits yet.</p>}
                    {visits.map((visit) => (
                      <Link key={visit.id} to={`${basePath.replace('/patients', '/submissions')}/${visit.id}`} className="block rounded-xl border border-slate-200 px-4 py-3 transition hover:border-brand-600 hover:bg-teal-50">
                        <p className="font-bold">{visit.formDate} · {visit.procedure}</p>
                        <p className="mt-1 text-base font-bold text-slate-600">{visit.doctorName}</p>
                        <div className="mt-2 flex flex-wrap gap-2"><RecordState unread={visit.unread} /><Badge tone={statusTone(visit.bookingStatus)}>{visit.bookingStatus?.replaceAll('_', ' ')}</Badge></div>
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
