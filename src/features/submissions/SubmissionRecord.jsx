import { CalendarCheck, CalendarX, Download, Eye, FileText, FolderOpen, Printer, Stethoscope, StickyNote, Trash2, Upload, UserRoundPen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, openProtectedFile, openProtectedPdf } from '../../services/api.js';
import { bytes, clinicToday, errorMessage, formatWhen } from '../../utils/format.js';
import { Badge, Button, Field, Modal, PageHeader, Spinner, TextArea, TextInput, statusTone, useToast } from '../../components/common/ui.jsx';

const tabs = ['Overview', 'Patient profile', 'Medical history', 'Documents', 'Prescriptions', 'Clinical remarks'];

function prettyStatus(status) {
  return String(status || '—').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

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
  const [uploading, setUploading] = useState(false);
  const [historyId, setHistoryId] = useState(null);
  const fileInput = useRef(null);

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

  async function uploadSelected(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) return;
    setUploading(true);
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    try {
      await api.post(`/submissions/${id}/documents`, form);
      toast.success(files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`);
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
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
          <button key={item} type="button" onClick={() => setTab(item)} className={`whitespace-nowrap rounded-full px-4 py-2 text-base font-bold ${tab === item ? 'bg-ink-900 text-white' : 'bg-white text-slate-600'}`}>{item}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Visit', `${prettyStatus(submission.department)} · ${submission.procedure}`, submission.formDate],
              ['Doctor', submission.doctorName, 'Assigned for this visit'],
              ['Booking', prettyStatus(submission.bookingStatus), submission.bookedAt ? `Booked ${formatWhen(submission.bookedAt)}` : 'Not booked yet'],
              ['Consultation', prettyStatus(submission.consultationStatus), submission.consultationCompletedAt ? formatWhen(submission.consultationCompletedAt) : 'Waiting for the doctor'],
            ].map(([label, value, hint]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-2 text-lg font-bold text-ink-900">{value || '—'}</p>
                <p className="mt-1 text-base font-bold text-slate-600">{hint}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-brand-700"><CalendarCheck size={20} /></span>
                  <div>
                    <h2 className="text-xl font-bold text-ink-900">Booking</h2>
                    <p className="text-base font-bold text-slate-600">{submission.bookedAt ? `Booked ${formatWhen(submission.bookedAt)}` : 'This visit is not booked yet'}</p>
                  </div>
                </div>
                <Badge tone={statusTone(submission.bookingStatus)}>{prettyStatus(submission.bookingStatus)}</Badge>
              </div>
              <div className="space-y-4 p-5">
                {capabilities.canBook && (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => saveBooking('BOOKED')} disabled={submission.bookingStatus === 'BOOKED'}><CalendarCheck size={18} /> Mark booked</Button>
                    <Button variant="secondary" onClick={() => saveBooking('NOT_BOOKED')} disabled={submission.bookingStatus === 'NOT_BOOKED'}><CalendarX size={18} /> Mark not booked</Button>
                  </div>
                )}
                {capabilities.canReassign && (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-900"><Stethoscope size={16} /> Assigned doctor</p>
                    <div className="grid gap-2">
                      <select className="field" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
                        {doctors.filter((doctor) => doctor.departments?.some((department) => department.code === submission.department) || doctor.id === submission.doctorId).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
                      </select>
                      <TextInput placeholder="Reason for reassignment" value={reason} onChange={(event) => setReason(event.target.value)} />
                      <Button variant="secondary" onClick={reassign}><UserRoundPen size={18} /> Reassign doctor</Button>
                    </div>
                  </div>
                )}
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Current status</p>
                  <p className="mt-1 text-lg font-bold text-ink-900">{prettyStatus(submission.bookingStatus)}</p>
                  <p className="text-base font-bold text-slate-600">{submission.bookedAt ? formatWhen(submission.bookedAt) : 'Updated in place when you change booking'}</p>
                </div>
              </div>
            </section>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-brand-700"><StickyNote size={20} /></span>
                <div>
                  <h2 className="text-xl font-bold text-ink-900">Operational remarks</h2>
                  <p className="text-base font-bold text-slate-600">Reception notes for this visit</p>
                </div>
              </div>
              <div className="space-y-4 p-5">
                {capabilities.canEditOperational ? (
                  <div className="space-y-3">
                    <TextArea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="Add a note for the desk" />
                    <Button onClick={saveRemark} disabled={!remark.trim() || remark.trim() === (submission.operationalRemark || '')}>Save remark</Button>
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-ink-900">{submission.operationalRemark || 'No operational remark.'}</p>
                )}
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
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === 'Patient profile' && (
        <section className="card grid gap-3 p-5 text-sm md:grid-cols-2">
          {[['Patient ID', patient.patientCode], ['Name', patient.fullName], ['Phone', patient.contactNumber], ['CNIC', patient.cnic], ['Date of birth', patient.dateOfBirth], ['Age', patient.age], ['Gender', patient.gender], ['Nationality', patient.nationality], ['Occupation', patient.occupationOther || patient.occupation], ['City', patient.city], ['Address', patient.address], ['Weight', `${submission.weightKg} kg`], ['Height', `${submission.heightCm} cm`], ['Referred by', submission.referredByOther || submission.referredByLabel]].map(([label, value]) => (
            <div key={label}><p className="text-slate-400">{label}</p><p className="font-bold text-slate-800">{value || '—'}</p></div>
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
              <h2 className="text-xl font-bold">{group.linked ? 'Linked ' : ''}{group.departmentCode} · {group.patientCode}</h2>
              <p className="text-base font-bold text-slate-600">{group.patientName}</p>
              <div className="mt-4 space-y-3">
                {group.submissions.map((item) => {
                  const open = historyId === item.id;
                  const surgery = item.surgeryDetails;
                  const skin = item.skinDetails;
                  return (
                    <article key={item.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-ink-900">{item.procedure}</p>
                          <p className="text-base font-bold text-slate-600">{item.formDate} · {item.doctorName}</p>
                          <div className="mt-2 flex gap-2">
                            <Badge tone={statusTone(item.bookingStatus)}>{item.bookingStatus?.replaceAll('_', ' ')}</Badge>
                            <Badge tone={statusTone(item.consultationStatus)}>{item.consultationStatus}</Badge>
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => setHistoryId(open ? null : item.id)}>{open ? 'Hide details' : 'View details'}</Button>
                      </div>
                      {open && (
                        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                          {[['Weight', item.weightKg ? `${item.weightKg} kg` : ''], ['Height', item.heightCm ? `${item.heightCm} cm` : ''], ['Age at visit', item.ageAtSubmission], ['Referred by', item.referredByOther || item.referredByLabel], ['Booked', formatWhen(item.bookedAt)], ['Operational remark', item.operationalRemark]].map(([label, value]) => (
                            <div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
                              <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
                              <p className="mt-1 font-bold text-ink-900">{value || '—'}</p>
                            </div>
                          ))}
                          {surgery && [['Anesthesia', surgery.anesthesiaTypeLabel], ['Diet', surgery.dietLabel], ['Blood test', surgery.bloodTestStatusLabel], ['Location', surgery.locationOfSurgeryLabel], ['MRI', surgery.mriLabel], ['Cost', surgery.surgeryCost], ['Follow-up sessions', surgery.followUpSessions], ['Any other', surgery.anyOther]].map(([label, value]) => (
                            <div key={label} className="rounded-xl bg-teal-50 px-3 py-2">
                              <p className="text-xs uppercase tracking-wide text-teal-700">{label}</p>
                              <p className="mt-1 font-bold text-ink-900">{value || '—'}</p>
                            </div>
                          ))}
                          {skin?.fields?.map((field) => (
                            <div key={field.key} className="rounded-xl bg-teal-50 px-3 py-2">
                              <p className="text-xs uppercase tracking-wide text-teal-700">{field.label}</p>
                              <p className="mt-1 font-bold text-ink-900">{field.value || '—'}</p>
                            </div>
                          ))}
                          {item.prescriptions?.map((rx) => <p key={rx.id} className="md:col-span-2 text-slate-600">Prescription v{rx.currentVersion}: {rx.versions?.[0]?.medicines?.map((med) => med.name).join(', ') || '—'}</p>)}
                          {item.remarks?.map((note) => <p key={note.id} className="md:col-span-2 text-slate-600">Remark: {note.versions?.[0]?.notes}</p>)}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'Documents' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-brand-700"><FolderOpen size={20} /></span>
              <div>
                <h2 className="text-xl font-bold text-ink-900">Documents</h2>
                <p className="text-base font-bold text-slate-600">{record.documents.filter((item) => !item.isDeleted).length} file{record.documents.filter((item) => !item.isDeleted).length === 1 ? '' : 's'} on this visit</p>
              </div>
            </div>
            {capabilities.canUpload && <Button disabled={uploading} onClick={() => fileInput.current?.click()}><Upload size={18} /> {uploading ? 'Uploading…' : 'Upload files'}</Button>}
          </div>
          {capabilities.canUpload && (
            <input
              ref={fileInput}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(event) => uploadSelected(event.target.files)}
            />
          )}
          {uploading && <p className="border-b border-slate-100 px-5 py-3 text-base font-bold text-slate-600">Uploading the selected file…</p>}
          {record.documents.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <FolderOpen className="mx-auto text-slate-300" size={36} />
              <p className="mt-3 text-base font-bold text-ink-900">No documents yet</p>
              <p className="mx-auto mt-1 max-w-sm text-base font-bold text-slate-600">Upload labs, scans, or consent forms. Each file can be opened or downloaded.</p>
              {capabilities.canUpload && <Button className="mt-4" onClick={() => fileInput.current?.click()}><Upload size={18} /> Upload files</Button>}
            </div>
          ) : (
            <ul>
              {record.documents.map((document) => (
                <li key={document.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><FileText size={18} /></span>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink-900">{document.originalFilename} {document.isDeleted && <Badge tone="rose">Deleted</Badge>}</p>
                      <p className="text-base font-bold text-slate-600">{bytes(document.size)} · {document.uploadedByName} · {formatWhen(document.createdAt)}</p>
                    </div>
                  </div>
                  {!document.isDeleted && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openProtectedFile(`/documents/${document.id}/view`, { mimeType: document.mimeType, filename: document.originalFilename }).catch((error) => toast.error(errorMessage(error)))}><Eye size={16} /> View</Button>
                      <Button size="sm" onClick={() => openProtectedFile(`/documents/${document.id}/download`, { downloadName: document.originalFilename, mimeType: document.mimeType }).catch((error) => toast.error(errorMessage(error)))}><Download size={16} /> Download</Button>
                      {capabilities.canUpload && <Button size="sm" variant="danger" onClick={async () => { await api.delete(`/documents/${document.id}`, { reason: 'Removed by user' }); await load(); }}><Trash2 size={16} /> Delete</Button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'Prescriptions' && (
        <section className="space-y-4">
          {capabilities.canEditClinical && (
            <form className="card space-y-3 p-5" onSubmit={savePrescription}>
              <h2 className="font-bold">{editingRx ? 'New prescription version' : 'New prescription'}</h2>
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
                <h3 className="font-bold">{rx.doctorName} · current v{rx.currentVersion}</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openProtectedPdf(`/prescriptions/${rx.id}/pdf`)}><FileText size={16} /> PDF</Button>
                  <Button size="sm" variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print</Button>
                  {rx.canEdit && <Button size="sm" onClick={() => { setEditingRx(rx.id); setTab('Prescriptions'); const current = rx.versions[0]; setMedicines(current.medicines); setRxDate(current.prescriptionDate); }}>Edit as new version</Button>}
                </div>
              </div>
              {rx.versions.map((version) => (
                <div key={version.id} className={`print-sheet mt-3 rounded-xl p-3 text-sm ${version.versionNumber === rx.currentVersion ? 'bg-teal-50' : 'bg-slate-50'}`}>
                  <p className="font-bold">Version {version.versionNumber} · {version.prescriptionDate} · {version.editedByName}</p>
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
              <h2 className="font-bold">{editingRemark ? 'New remark version' : 'New clinical remark'}</h2>
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
                <h3 className="font-bold">{remarkItem.doctorName}</h3>
                {remarkItem.canEdit && <Button size="sm" onClick={() => { setEditingRemark(remarkItem.id); setNotes(remarkItem.versions[0].notes); setSelectedCategories(remarkItem.versions[0].categories); }}>Update as new version</Button>}
              </div>
              {remarkItem.versions.map((version) => (
                <div key={version.id} className="mt-3 rounded-xl bg-slate-50 p-3">
                  <p className="font-bold">Version {version.versionNumber} · {version.categoryLabels?.join(', ')} · {formatWhen(version.createdAt)}</p>
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
