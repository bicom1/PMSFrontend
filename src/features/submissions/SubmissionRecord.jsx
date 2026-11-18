import { CalendarCheck, CalendarX, Download, Eye, FileText, Printer, Trash2, UserRoundPen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, openProtectedPdf } from '../../services/api.js';
import { bytes, clinicToday, errorMessage, formatWhen } from '../../utils/format.js';
import { Badge, Button, Field, Modal, PageHeader, Spinner, TextArea, TextInput, statusTone, useToast } from '../../components/common/ui.jsx';

const tabs = ['Overview', 'Patient profile', 'Medical history', 'Documents', 'Prescriptions', 'Clinical remarks'];

export default function SubmissionRecord({ id }) {
  const toast = useToast();
  const [record, setRecord] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [doctors, setDoctors] = useState([]);
  const [remark, setRemark] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [reason, setReason] = useState('');
  const [medicines, setMedicines] = useState([{ name: '', dose: '', frequency: '', duration: '', instructions: '' }]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [notes, setNotes] = useState('');
  const [rxDate, setRxDate] = useState(clinicToday);
  const [editingRx, setEditingRx] = useState(null);
  const [editingRemark, setEditingRemark] = useState(null);

  async function load() {
    const body = await api.get(`/submissions/${id}`);
    setRecord(body.data);
    setRemark(body.data.submission.operationalRemark || '');
    setDoctorId(body.data.submission.doctorId);
  }

  useEffect(() => {
    load().catch((error) => toast.error(errorMessage(error)));
    api.get('/master-data', { type: 'REMARK_CATEGORY', active: 'true' }).then((body) => setCategories(body.data)).catch(() => {});
    api.get('/directory/doctors', { limit: '100' }).then((body) => setDoctors(body.data)).catch(() => {});
  }, [id]);

  if (!record) return <Spinner label="Opening record" />;
  const { submission, patient, capabilities } = record;
  const visibleTabs = tabs.filter((item) => {
    if (item === 'Prescriptions' || item === 'Clinical remarks') return capabilities.canViewClinical;
    return true;
  });

  async function saveBooking(status) {
    try {
      await api.patch(`/submissions/${id}/booking`, { status, remark });
      toast.success(status === 'BOOKED' ? 'Marked booked' : 'Marked not booked');
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
  }

  async function reassign() {
    try {
      await api.patch(`/submissions/${id}/doctor`, { doctorId, reason });
      toast.success('Doctor updated');
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
  }

  async function saveRemark() {
    try {
      await api.patch(`/submissions/${id}/operational-remark`, { text: remark });
      toast.success('Operational remark saved');
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
  }

  async function upload(event) {
    const files = [...event.target.files];
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    try {
      await api.post(`/submissions/${id}/documents`, form);
      toast.success('Document uploaded');
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
    event.target.value = '';
  }

  async function savePrescription(event) {
    event.preventDefault();
    const payload = { prescriptionDate: rxDate, medicines: medicines.filter((item) => item.name), note: reason };
    try {
      if (editingRx) await api.post(`/prescriptions/${editingRx}/versions`, payload);
      else await api.post(`/submissions/${id}/prescriptions`, payload);
      toast.success(editingRx ? 'Prescription version saved' : 'Prescription saved');
      setEditingRx(null);
      setMedicines([{ name: '', dose: '', frequency: '', duration: '', instructions: '' }]);
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
  }

  async function saveClinical(event) {
    event.preventDefault();
    const payload = { categories: selectedCategories, notes };
    try {
      if (editingRemark) await api.post(`/remarks/${editingRemark}/versions`, payload);
      else await api.post(`/submissions/${id}/remarks`, payload);
      toast.success(editingRemark ? 'Remark version saved' : 'Remark saved');
      setEditingRemark(null);
      setNotes('');
      await load();
    } catch (error) { toast.error(errorMessage(error)); }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={`${submission.patientCode} · ${patient.fullName}`}
        text={`${submission.department} · ${submission.procedure} · ${submission.doctorName}`}
        actions={<>
          <Badge tone={statusTone(submission.bookingStatus)}>{submission.bookingStatus.replaceAll('_', ' ')}</Badge>
          <Badge tone={statusTone(submission.consultationStatus)}>{submission.consultationStatus}</Badge>
        </>}
      />
      <div className="flex gap-2 overflow-x-auto">
        {visibleTabs.map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm ${tab === item ? 'bg-ink-900 text-white' : 'bg-white text-slate-600'}`}>{item}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card space-y-3 p-5">
            <h2 className="font-semibold">Booking</h2>
            <p className="text-sm text-slate-500">Booked at: {formatWhen(submission.bookedAt)}</p>
            {capabilities.canBook && (
              <div className="flex gap-2">
                <Button onClick={() => saveBooking('BOOKED')}><CalendarCheck size={18} /> Mark booked</Button>
                <Button variant="secondary" onClick={() => saveBooking('NOT_BOOKED')}><CalendarX size={18} /> Mark not booked</Button>
              </div>
            )}
            {capabilities.canReassign && (
              <div className="grid gap-2">
                <select className="field" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
                  {doctors.filter((doctor) => doctor.departments?.some((department) => department.code === submission.department) || doctor.id === submission.doctorId).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
                </select>
                <TextInput placeholder="Reason for reassignment" value={reason} onChange={(event) => setReason(event.target.value)} />
                <Button variant="secondary" onClick={reassign}><UserRoundPen size={18} /> Reassign doctor</Button>
              </div>
            )}
            <h3 className="pt-2 font-medium">Booking history</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              {submission.bookingHistory?.length ? submission.bookingHistory.map((item, index) => <li key={index}>{item.fromStatus || '—'} → {item.toStatus} · {item.byName} · {formatWhen(item.at)}</li>) : <li>No booking changes yet.</li>}
            </ul>
          </section>
          <section className="card space-y-3 p-5">
            <h2 className="font-semibold">Operational remarks</h2>
            {capabilities.canEditOperational ? (
              <>
                <TextArea value={remark} onChange={(event) => setRemark(event.target.value)} />
                <Button onClick={saveRemark}>Save remark</Button>
              </>
            ) : <p className="text-sm">{submission.operationalRemark || 'No operational remark.'}</p>}
            <ul className="space-y-2 text-sm text-slate-500">
              {submission.operationalRemarkHistory?.map((item, index) => <li key={index}>{formatWhen(item.at)} · {item.authorName}: {item.text}</li>)}
            </ul>
            {capabilities.canEditClinical && (
              <Button onClick={async () => {
                try {
                  await api.patch(`/doctor/patients/${id}/consultation`, { status: submission.consultationStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED' });
                  toast.success('Consultation updated');
                  await load();
                } catch (error) { toast.error(errorMessage(error)); }
              }}>
                {submission.consultationStatus === 'COMPLETED' ? 'Reopen consultation' : 'Mark consultation complete'}
              </Button>
            )}
          </section>
        </div>
      )}

      {tab === 'Patient profile' && (
        <section className="card grid gap-3 p-5 text-sm md:grid-cols-2">
          {[['Patient ID', patient.patientCode], ['Name', patient.fullName], ['Phone', patient.contactNumber], ['CNIC', patient.cnic], ['Date of birth', patient.dateOfBirth], ['Age', patient.age], ['Gender', patient.gender], ['Nationality', patient.nationality], ['Occupation', patient.occupationOther || patient.occupation], ['City', patient.city], ['Address', patient.address], ['Weight', `${submission.weightKg} kg`], ['Height', `${submission.heightCm} cm`], ['Referred by', submission.referredByOther || submission.referredByLabel]].map(([label, value]) => (
            <div key={label}><p className="text-slate-400">{label}</p><p className="font-medium text-slate-800">{value || '—'}</p></div>
          ))}
          {record.surgeryDetails && <div className="md:col-span-2 grid gap-3 md:grid-cols-2 rounded-xl bg-slate-50 p-4">
            <p className="md:col-span-2 text-sm text-amber-800">Surgery fields are provisional pending clinic confirmation. Cost is not a payment.</p>
            {[['Anesthesia', record.surgeryDetails.anesthesiaTypeLabel], ['Diet', record.surgeryDetails.dietLabel], ['Blood test', record.surgeryDetails.bloodTestStatusLabel], ['Location', record.surgeryDetails.locationOfSurgeryLabel], ['MRI', record.surgeryDetails.mriLabel], ['Cost', record.surgeryDetails.surgeryCost], ['Follow-up sessions', record.surgeryDetails.followUpSessions], ['Any other', record.surgeryDetails.anyOther]].map(([label, value]) => <div key={label}><p className="text-slate-400">{label}</p><p>{value || '—'}</p></div>)}
          </div>}
          {record.skinDetails && <div className="md:col-span-2 rounded-xl bg-amber-50 p-4 text-amber-900">Skin-specific fields are pending clinic confirmation. {record.skinDetails.fields?.length ? '' : 'No additional skin fields have been configured.'}
            <div className="mt-3 grid gap-2 md:grid-cols-2">{record.skinDetails.fields?.map((field) => <div key={field.key}><p className="text-slate-500">{field.label}</p><p>{field.value || '—'}</p></div>)}</div>
          </div>}
          <div className="md:col-span-2 text-xs text-slate-500">Policy version {submission.policyAcknowledgement?.versionNumber} acknowledged {formatWhen(submission.policyAcknowledgement?.acknowledgedAt)}.</div>
        </section>
      )}

      {tab === 'Medical history' && (
        <div className="space-y-4">
          {record.history.map((group) => (
            <section key={`${group.departmentCode}-${group.patientCode}`} className="card p-5">
              <h2 className="font-semibold">{group.linked ? 'Linked ' : ''}{group.departmentCode} · {group.patientCode}</h2>
              <div className="mt-3 space-y-3">
                {group.submissions.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                    <p className="font-medium">{item.procedure} · {item.doctorName} · {item.formDate}</p>
                    <p className="text-slate-500">{item.bookingStatus} {item.bookedAt ? `· booked ${formatWhen(item.bookedAt)}` : ''}</p>
                    {item.prescriptions?.map((rx) => <p key={rx.id} className="mt-1 text-slate-600">Prescription v{rx.currentVersion}: {rx.versions?.[0]?.medicines?.map((med) => med.name).join(', ')} <span className="text-slate-400">(read only in history)</span></p>)}
                    {item.remarks?.map((note) => <p key={note.id} className="text-slate-600">Remark: {note.versions?.[0]?.notes}</p>)}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'Documents' && (
        <section className="card space-y-4 p-5">
          {capabilities.canUpload && <input type="file" accept="application/pdf,.pdf" multiple onChange={upload} />}
          <ul className="space-y-2">
            {record.documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{document.originalFilename} {document.isDeleted && <Badge tone="rose">Deleted</Badge>}</p>
                  <p className="text-slate-500">{bytes(document.size)} · {document.uploadedByName} · {formatWhen(document.createdAt)}</p>
                </div>
                {!document.isDeleted && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openProtectedPdf(`/documents/${document.id}/view`).catch((error) => toast.error(errorMessage(error)))}><Eye size={16} /> View</Button>
                    <Button size="sm" variant="secondary" onClick={() => openProtectedPdf(`/documents/${document.id}/download`, { downloadName: document.originalFilename }).catch((error) => toast.error(errorMessage(error)))}><Download size={16} /> Download</Button>
                    {capabilities.canUpload && <Button size="sm" variant="danger" onClick={async () => { await api.delete(`/documents/${document.id}`, { reason: 'Removed by user' }); await load(); }}><Trash2 size={16} /> Delete</Button>}
                  </div>
                )}
              </li>
            ))}
            {record.documents.length === 0 && <p className="text-sm text-slate-500">No documents uploaded.</p>}
          </ul>
        </section>
      )}

      {tab === 'Prescriptions' && (
        <section className="space-y-4">
          {capabilities.canEditClinical && (
            <form className="card space-y-3 p-5" onSubmit={savePrescription}>
              <h2 className="font-semibold">{editingRx ? 'New prescription version' : 'New prescription'}</h2>
              <Field label="Prescription date"><TextInput type="date" value={rxDate} onChange={(event) => setRxDate(event.target.value)} required /></Field>
              {medicines.map((medicine, index) => (
                <div key={index} className="grid gap-2 md:grid-cols-5">
                  {['name', 'dose', 'frequency', 'duration', 'instructions'].map((key) => (
                    <TextInput key={key} placeholder={key} value={medicine[key]} onChange={(event) => setMedicines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: event.target.value } : item))} />
                  ))}
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setMedicines((current) => [...current, { name: '', dose: '', frequency: '', duration: '', instructions: '' }])}>Add medicine</Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          )}
          {record.prescriptions.map((rx) => (
            <article key={rx.id} className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{rx.doctorName} · current v{rx.currentVersion}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openProtectedPdf(`/prescriptions/${rx.id}/pdf`)}><FileText size={16} /> PDF</Button>
                  <Button size="sm" variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print</Button>
                  {rx.canEdit && <Button size="sm" onClick={() => { setEditingRx(rx.id); setTab('Prescriptions'); const current = rx.versions[0]; setMedicines(current.medicines); setRxDate(current.prescriptionDate); }}>Edit as new version</Button>}
                </div>
              </div>
              {rx.versions.map((version) => (
                <div key={version.id} className={`print-sheet mt-3 rounded-xl p-3 text-sm ${version.versionNumber === rx.currentVersion ? 'bg-teal-50' : 'bg-slate-50'}`}>
                  <p className="font-medium">Version {version.versionNumber} · {version.prescriptionDate} · {version.editedByName}</p>
                  <ul className="mt-1 list-disc pl-5">{version.medicines.map((medicine, index) => <li key={index}>{medicine.name} — {medicine.dose}, {medicine.frequency}, {medicine.duration}. {medicine.instructions}</li>)}</ul>
                </div>
              ))}
            </article>
          ))}
        </section>
      )}

      {tab === 'Clinical remarks' && (
        <section className="space-y-4">
          {capabilities.canEditClinical && (
            <form className="card space-y-3 p-5" onSubmit={saveClinical}>
              <h2 className="font-semibold">{editingRemark ? 'New remark version' : 'New clinical remark'}</h2>
              <div className="flex flex-wrap gap-3 text-sm">
                {categories.map((category) => (
                  <label key={category.value} className="flex items-center gap-2">
                    <input type="checkbox" checked={selectedCategories.includes(category.value)} onChange={(event) => setSelectedCategories((current) => event.target.checked ? [...current, category.value] : current.filter((value) => value !== category.value))} />
                    {category.label}
                  </label>
                ))}
              </div>
              <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Clinical notes" />
              <Button type="submit">Save remark</Button>
            </form>
          )}
          {record.remarks.map((remarkItem) => (
            <article key={remarkItem.id} className="card p-5 text-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{remarkItem.doctorName}</h3>
                {remarkItem.canEdit && <Button size="sm" onClick={() => { setEditingRemark(remarkItem.id); setNotes(remarkItem.versions[0].notes); setSelectedCategories(remarkItem.versions[0].categories); }}>Update as new version</Button>}
              </div>
              {remarkItem.versions.map((version) => (
                <div key={version.id} className="mt-3 rounded-xl bg-slate-50 p-3">
                  <p className="font-medium">Version {version.versionNumber} · {version.categoryLabels?.join(', ')} · {formatWhen(version.createdAt)}</p>
                  <p className="mt-1">{version.notes}</p>
                  {version.versionNumber !== remarkItem.currentVersion && <p className="text-xs text-slate-400">Preserved historical version</p>}
                </div>
              ))}
            </article>
          ))}
        </section>
      )}
      <Modal open={false} title="" onClose={() => {}} />
    </div>
  );
}
