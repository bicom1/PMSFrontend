import { Download, Eye, FileText, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, loadProtectedFile, openProtectedFile } from '../../services/api.js';
import { bytes, errorMessage, formatWhen } from '../../utils/format.js';
import { Badge, Button, Field, TextInput, useToast } from '../../components/common/ui.jsx';

export const DOCUMENT_KINDS = [
  { value: 'LAB', label: 'Lab report' },
  { value: 'SCAN', label: 'Scan or photo' },
  { value: 'CONSENT', label: 'Consent form' },
  { value: 'IDENTITY', label: 'Identity document' },
  { value: 'OTHER', label: 'Other clinical file' },
];

const allowed = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv']);

function extensionOf(name) {
  return (String(name || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/) || [])[1] || '';
}

function fileProblem(file) {
  const extension = extensionOf(file.name);
  if (!allowed.has(extension)) return `${file.name} must be a PDF, image, Word, Excel, or text file`;
  if (!file.size) return `${file.name} is empty`;
  if (file.size > 10 * 1024 * 1024) return `${file.name} is larger than 10 MB`;
  return '';
}

function departmentLabel(code) {
  if (code === 'SKIN') return 'Skin';
  if (code === 'SURGERY') return 'Surgery';
  return code || 'Visit';
}

export default function DocumentPanel({ documents = [], visits = [], canUpload = false, submissionId = '', onChanged }) {
  const toast = useToast();
  const fileInput = useRef(null);
  const [kind, setKind] = useState('LAB');
  const [note, setNote] = useState('');
  const [visitId, setVisitId] = useState(submissionId || visits[0]?.id || '');
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState(null);
  const previewUrl = useRef(null);
  const viewRequest = useRef(0);
  const targetId = submissionId || visitId;

  function closePreview() {
    viewRequest.current += 1;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setPreview(null);
  }

  useEffect(() => () => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);
  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') closePreview(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  async function uploadSelected(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) return;
    if (!targetId) {
      toast.error('Choose the visit these files belong to.');
      return;
    }
    const problem = files.map(fileProblem).find(Boolean);
    if (problem) {
      toast.error(problem);
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append('category', kind);
    form.append('note', note.trim());
    files.forEach((file) => form.append('files', file));
    try {
      await api.post(`/submissions/${targetId}/documents`, form);
      toast.success(files.length === 1 ? 'Document added to the visit' : `${files.length} documents added to the visit`);
      setNote('');
      await onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function removeDocument(document) {
    if (reason.trim().length < 5) {
      toast.error('Enter a short reason before removing the file.');
      return;
    }
    try {
      await api.delete(`/documents/${document.id}`, { reason: reason.trim() });
      toast.success('Document removed');
      setRemovingId('');
      setReason('');
      await onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function viewDocument(document) {
    const request = ++viewRequest.current;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setPreview({ name: document.originalFilename, loading: true });
    try {
      const loaded = await loadProtectedFile(`/documents/${document.id}/view`, { mimeType: document.mimeType, filename: document.originalFilename });
      if (request !== viewRequest.current) {
        URL.revokeObjectURL(loaded.url);
        return;
      }
      previewUrl.current = loaded.url;
      setPreview({ name: document.originalFilename, url: loaded.url, type: loaded.type });
    } catch (error) {
      if (request !== viewRequest.current) return;
      setPreview(null);
      toast.error(errorMessage(error));
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
        <h2 className="text-xl font-bold text-ink-900">Patient documents</h2>
        <p className="mt-1 text-base font-bold text-slate-600">An administrator or clinic manager adds the file to a visit. A clinic manager can remove only a file they uploaded. An administrator can remove any file. The removal is kept in the audit log.</p>
      </div>
      {canUpload && (
        <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-2">
          {!submissionId && visits.length > 1 && (
            <Field label="Add to this visit">
              <select className="field" value={visitId} onChange={(event) => setVisitId(event.target.value)}>
                {visits.map((visit) => <option key={visit.id} value={visit.id}>{departmentLabel(visit.departmentCode)} · {visit.patientCode} · {visit.formDate} · {visit.procedure}</option>)}
              </select>
            </Field>
          )}
          <Field label="What is this file?">
            <select className="field" value={kind} onChange={(event) => setKind(event.target.value)}>
              {DOCUMENT_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <Field label="Note, optional">
            <TextInput value={note} maxLength={240} placeholder="Example: CBC from the referring clinic" onChange={(event) => setNote(event.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button disabled={uploading || !targetId} onClick={() => fileInput.current?.click()}><Upload size={18} /> {uploading ? 'Uploading…' : 'Choose files'}</Button>
            <input ref={fileInput} className="hidden" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={(event) => uploadSelected(event.target.files)} />
          </div>
          <p className="text-sm font-bold text-slate-500 sm:col-span-2">PDF, images, Word, Excel, and text. Up to 10 files, 10 MB each.</p>
        </div>
      )}
      {documents.length === 0 ? (
        <p className="px-5 py-8 text-base font-bold text-slate-500">No documents on this patient yet.</p>
      ) : (
        <ul>
          {documents.map((document) => (
            <li key={document.id} className="border-b border-slate-100 px-5 py-4 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><FileText size={18} /></span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink-900">{document.originalFilename} {document.isDeleted && <Badge tone="rose">Removed</Badge>}</p>
                    <p className="text-base font-bold text-slate-600">{document.categoryLabel}{document.note ? ` · ${document.note}` : ''}</p>
                    <p className="text-sm font-bold text-slate-500">{[document.departmentCode && `${departmentLabel(document.departmentCode)} ${document.patientCode}`, bytes(document.size), document.uploadedByName, formatWhen(document.createdAt)].filter(Boolean).join(' · ')}</p>
                  </div>
                </div>
                {!document.isDeleted && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => viewDocument(document)}><Eye size={16} /> View</Button>
                    <Button size="sm" onClick={() => openProtectedFile(`/documents/${document.id}/download`, { downloadName: document.originalFilename, mimeType: document.mimeType }).catch((error) => toast.error(errorMessage(error)))}><Download size={16} /> Download</Button>
                    {document.canDelete && <Button size="sm" variant="danger" onClick={() => { setRemovingId(document.id); setReason(''); }}><Trash2 size={16} /> Remove</Button>}
                  </div>
                )}
              </div>
              {removingId === document.id && (
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <TextInput value={reason} placeholder="Why is this file being removed?" onChange={(event) => setReason(event.target.value)} />
                  <Button variant="danger" onClick={() => removeDocument(document)}>Confirm removal</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {preview && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-950/70 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={preview.name}>
          <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(92vh,900px)] sm:max-w-6xl sm:rounded-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <p className="min-w-0 truncate text-lg font-bold text-ink-900">{preview.name}</p>
              <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-ink-900" onClick={closePreview} aria-label="Close document"><X size={22} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-100">
              {preview.loading && <p className="p-6 text-base font-bold text-slate-600">Opening document…</p>}
              {!preview.loading && preview.type?.startsWith('image/') && <img src={preview.url} alt={preview.name} className="mx-auto max-h-full max-w-full object-contain" />}
              {!preview.loading && preview.type === 'application/pdf' && <iframe title={preview.name} src={preview.url} className="h-full min-h-[70vh] w-full border-0 bg-white" />}
              {!preview.loading && preview.type !== 'application/pdf' && (preview.type?.startsWith('text/') || preview.type === 'application/json') && <iframe title={preview.name} src={preview.url} sandbox="" className="h-full min-h-[70vh] w-full border-0 bg-white" />}
              {!preview.loading && preview.url && !preview.type?.startsWith('image/') && preview.type !== 'application/pdf' && !preview.type?.startsWith('text/') && preview.type !== 'application/json' && (
                <div className="mx-auto max-w-md px-6 py-16 text-center">
                  <FileText className="mx-auto text-slate-300" size={40} />
                  <p className="mt-3 text-lg font-bold text-ink-900">This file opens with Download</p>
                  <p className="mt-2 text-base font-bold text-slate-600">Word and Excel files stay in the clinic record. Use Download to open them on this computer.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
