import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api.js';
import { errorMessage } from '../../utils/format.js';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import { Button, Field, Modal, PageHeader, Spinner, TextArea, TextInput, useToast } from '../../components/common/ui.jsx';

const SECTION_META = {
  identification: { title: 'Identification', text: 'Patient identity fields used when registering a visit.' },
  personal: { title: 'Personal details', text: 'Personal and measurement fields on this form.' },
  visit: { title: 'Visit', text: 'Doctor, procedure, and visit details.' },
  details: { title: 'Department details', text: 'Department-specific fields for this form.' },
};

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'tel', label: 'Phone' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Dropdown' },
];

function optionsOf(items) {
  return (items || []).map((item) => ({
    value: String(item.value || item._id || item.id),
    label: item.label || item.name || item.fullName,
  }));
}

function emptyFieldForm() {
  return {
    label: '',
    fieldType: 'text',
    section: 'details',
    required: false,
    placeholder: '',
    optionsText: '',
  };
}

export default function FormManagementScreen({ departmentCode, base = '/manager/form-management' }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState([]);
  const [catalog, setCatalog] = useState({});
  const [preview, setPreview] = useState({});
  const [editor, setEditor] = useState(null);
  const [optionManager, setOptionManager] = useState(null);

  const title = departmentCode === 'SKIN' ? 'Skin department form' : 'Surgery department form';
  const activeFields = useMemo(() => fields.filter((item) => item.isActive !== false), [fields]);
  const inactiveFields = useMemo(() => fields.filter((item) => item.isActive === false), [fields]);

  async function load() {
    setLoading(true);
    try {
      const [fieldBody, nationalityBody, occupationBody, cityBody, referralBody, procedureBody, doctorBody, surgeryLists] = await Promise.all([
        api.get('/form-fields', { departmentCode }),
        api.get('/master-data', { type: 'NATIONALITY', active: 'true' }),
        api.get('/master-data', { type: 'OCCUPATION', active: 'true' }),
        api.get('/master-data', { type: 'CITY', active: 'true' }),
        api.get('/master-data', { type: 'REFERRAL_SOURCE', active: 'true' }),
        api.get('/procedures', { departmentCode, active: 'true' }),
        api.get('/directory/doctors', { departmentCode, limit: '100' }),
        departmentCode === 'SURGERY'
          ? Promise.all(['ANESTHESIA_TYPE', 'DIET', 'BLOOD_TEST_STATUS', 'SURGERY_LOCATION', 'MRI_STATUS'].map((type) => api.get('/master-data', { type, active: 'true' })))
          : Promise.resolve([]),
      ]);
      const surgery = {};
      if (departmentCode === 'SURGERY') {
        ['anesthesia', 'diet', 'blood', 'location', 'mri'].forEach((key, index) => { surgery[key] = surgeryLists[index].data || []; });
      }
      setFields(fieldBody.data || []);
      setCatalog({
        NATIONALITY: nationalityBody.data || [],
        OCCUPATION: occupationBody.data || [],
        CITY: cityBody.data || [],
        REFERRAL_SOURCE: referralBody.data || [],
        GENDER: [{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }],
        WEIGHT: Array.from({ length: 151 }, (_, index) => ({ value: String(30 + index), label: `${30 + index} kg` })),
        HEIGHT: Array.from({ length: 61 }, (_, index) => ({ value: String(36 + index), label: `${36 + index} in` })),
        FOLLOW_UP: Array.from({ length: 13 }, (_, index) => ({ value: String(index), label: `${index}` })),
        ANESTHESIA_TYPE: surgery.anesthesia || [],
        DIET: surgery.diet || [],
        BLOOD_TEST_STATUS: surgery.blood || [],
        SURGERY_LOCATION: surgery.location || [],
        MRI_STATUS: surgery.mri || [],
        procedures: procedureBody.data || [],
        doctors: doctorBody.data || [],
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [departmentCode]);

  function refreshCaches() {
    queryClient.invalidateQueries({ queryKey: ['form-fields'] });
    queryClient.invalidateQueries({ queryKey: ['master-data'] });
    queryClient.invalidateQueries({ queryKey: ['procedures'] });
  }

  function optionsFor(field) {
    if (field.fieldType === 'doctor') return optionsOf(catalog.doctors);
    if (field.fieldType === 'procedure') return optionsOf(catalog.procedures);
    if (field.optionsSource === 'GENDER') return optionsOf(catalog.GENDER);
    if (field.optionsSource) return optionsOf(catalog[field.optionsSource] || []);
    if (field.metadata?.options?.length) return field.metadata.options.map((item) => ({ value: String(item), label: String(item) }));
    return [];
  }

  async function saveField(event) {
    event.preventDefault();
    if (!editor) return;
    try {
      const metadata = editor.form.fieldType === 'select' && !editor.editing?.optionsSource
        ? { options: editor.form.optionsText.split('\n').map((line) => line.trim()).filter(Boolean) }
        : editor.editing?.metadata || {};
      if (editor.editing) {
        await api.patch(`/form-fields/${editor.editing._id}`, {
          label: editor.form.label.trim(),
          required: editor.form.required,
          placeholder: editor.form.placeholder,
          section: editor.form.section,
          fieldType: editor.form.fieldType,
          metadata,
          isActive: true,
        });
      } else {
        await api.post('/form-fields', {
          departmentCode,
          label: editor.form.label.trim(),
          section: editor.form.section,
          fieldType: editor.form.fieldType,
          required: editor.form.required,
          placeholder: editor.form.placeholder,
          allowCustom: editor.form.fieldType === 'select',
          metadata,
        });
      }
      toast.success('Saved');
      setEditor(null);
      refreshCaches();
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function removeField(field) {
    if (!window.confirm(`Remove “${field.label}” from this form?`)) return;
    try {
      await api.delete(`/form-fields/${field._id}`);
      toast.success('Removed');
      refreshCaches();
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function restoreField(field) {
    try {
      await api.patch(`/form-fields/${field._id}`, { isActive: true });
      toast.success('Restored on form');
      refreshCaches();
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function saveOption(event) {
    event.preventDefault();
    if (!optionManager) return;
    try {
      if (optionManager.editing) {
        await api.patch(`/master-data/${optionManager.editing._id}`, {
          label: optionManager.form.label.trim(),
          value: optionManager.form.value.trim() || undefined,
        });
      } else {
        await api.post('/master-data', {
          type: optionManager.type,
          label: optionManager.form.label.trim(),
          value: optionManager.form.value.trim() || undefined,
          departmentCode,
        });
      }
      toast.success('Option saved');
      setOptionManager((current) => current ? { ...current, editing: null, form: { label: '', value: '' } } : null);
      refreshCaches();
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function deleteOption(row) {
    if (!window.confirm(`Delete “${row.label}”?`)) return;
    try {
      await api.delete(`/master-data/${row._id}`);
      toast.success('Deleted');
      refreshCaches();
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  function renderControl(field) {
    const value = preview[field.key] || '';
    const setValue = (next) => setPreview((current) => ({ ...current, [field.key]: next }));
    if (field.fieldType === 'age') return <Field label={field.label}><TextInput value="" placeholder="Auto" disabled /></Field>;
    if (field.fieldType === 'textarea') return <Field label={field.label}><TextArea value={value} onChange={(event) => setValue(event.target.value)} placeholder={field.placeholder || field.label} /></Field>;
    if (field.fieldType === 'select' || field.fieldType === 'doctor' || field.fieldType === 'procedure') {
      return (
        <SearchableSelect
          label={field.label}
          options={optionsFor(field)}
          value={value}
          onChange={setValue}
          placeholder={field.placeholder || field.label}
          allowCustom={Boolean(field.allowCustom)}
        />
      );
    }
    return (
      <Field label={field.label}>
        <TextInput
          type={field.fieldType === 'number' || field.fieldType === 'date' || field.fieldType === 'tel' ? field.fieldType : 'text'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={field.placeholder || field.label}
        />
      </Field>
    );
  }

  if (loading) return <Spinner label="Loading form" />;

  const sections = ['identification', 'personal', 'visit', ...(departmentCode === 'SURGERY' || activeFields.some((item) => item.section === 'details') ? ['details'] : [])];

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        text="Add, edit, or delete any field. Changes apply to the patient form."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setEditor({ editing: null, form: emptyFieldForm() })}><Plus size={16} /> Add field</Button>
            <Link to={base} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <ArrowLeft size={16} /> Back
            </Link>
          </div>
        )}
      />

      {sections.map((section) => {
        const sectionFields = activeFields.filter((item) => item.section === section);
        if (!sectionFields.length && section !== 'details') return null;
        const meta = SECTION_META[section];
        return (
          <section key={section} className="card space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-ink-900">{meta.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{meta.text}</p>
              </div>
              {section === 'details' && (
                <Button size="sm" onClick={() => setEditor({ editing: null, form: { ...emptyFieldForm(), section: 'details' } })}>
                  <Plus size={14} /> Add field
                </Button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {sectionFields.map((field) => (
                <div key={field._id} className="rounded-2xl border border-slate-100 p-3">
                  {renderControl(field)}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditor({
                      editing: field,
                      form: {
                        label: field.label,
                        fieldType: field.fieldType,
                        section: field.section,
                        required: Boolean(field.required),
                        placeholder: field.placeholder || '',
                        optionsText: (field.metadata?.options || []).join('\n'),
                      },
                    })}>
                      <Pencil size={14} /> Edit
                    </Button>
                    {['NATIONALITY', 'OCCUPATION', 'CITY', 'REFERRAL_SOURCE', 'ANESTHESIA_TYPE', 'DIET', 'BLOOD_TEST_STATUS', 'SURGERY_LOCATION', 'MRI_STATUS'].includes(field.optionsSource) && (
                      <Button size="sm" variant="secondary" onClick={() => setOptionManager({
                        type: field.optionsSource,
                        title: field.label,
                        rows: catalog[field.optionsSource] || [],
                        form: { label: '', value: '' },
                        editing: null,
                      })}>
                        Options
                      </Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => removeField(field)}>
                      <Trash2 size={14} /> Delete
                    </Button>
                  </div>
                </div>
              ))}
              {!sectionFields.length && <p className="sm:col-span-2 text-sm font-bold text-slate-500">No fields in this section. Add one.</p>}
            </div>
          </section>
        );
      })}

      {!!inactiveFields.length && (
        <section className="card space-y-3 p-5">
          <h2 className="text-xl font-bold text-ink-900">Removed fields</h2>
          <p className="text-sm text-slate-600">These fields are hidden from the patient form. Restore one if you need it again.</p>
          <div className="flex flex-wrap gap-2">
            {inactiveFields.map((field) => (
              <Button key={field._id} size="sm" variant="secondary" onClick={() => restoreField(field)}>
                Restore {field.label}
              </Button>
            ))}
          </div>
        </section>
      )}

      <Modal open={Boolean(editor)} title={editor?.editing ? `Edit ${editor.editing.label}` : 'Add field'} onClose={() => setEditor(null)}>
        {editor && (
          <form className="space-y-3" onSubmit={saveField}>
            <Field label="Name">
              <TextInput value={editor.form.label} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, label: event.target.value } })} required placeholder="Field name" />
            </Field>
            <Field label="Section">
              <select className="field" value={editor.form.section} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, section: event.target.value } })}>
                {Object.entries(SECTION_META).map(([value, item]) => <option key={value} value={value}>{item.title}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className="field" value={editor.form.fieldType} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, fieldType: event.target.value } })}>
                {FIELD_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="Placeholder">
              <TextInput value={editor.form.placeholder} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, placeholder: event.target.value } })} />
            </Field>
            {editor.form.fieldType === 'select' && (
              <Field label="Dropdown options">
                <TextArea value={editor.form.optionsText} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, optionsText: event.target.value } })} placeholder={'One option per line'} />
              </Field>
            )}
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={editor.form.required} onChange={(event) => setEditor({ ...editor, form: { ...editor.form, required: event.target.checked } })} />
              Required
            </label>
            <Button type="submit">{editor.editing ? 'Save' : 'Add'}</Button>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(optionManager)} title={`Options · ${optionManager?.title || ''}`} onClose={() => setOptionManager(null)}>
        {optionManager && (
          <div className="space-y-4">
            <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveOption}>
              <Field label="Name"><TextInput value={optionManager.form.label} onChange={(event) => setOptionManager({ ...optionManager, form: { ...optionManager.form, label: event.target.value } })} required /></Field>
              <Field label="Value"><TextInput value={optionManager.form.value} onChange={(event) => setOptionManager({ ...optionManager, form: { ...optionManager.form, value: event.target.value } })} /></Field>
              <div className="sm:col-span-2"><Button type="submit">{optionManager.editing ? 'Save option' : 'Add option'}</Button></div>
            </form>
            <div className="max-h-72 space-y-2 overflow-auto">
              {(catalog[optionManager.type] || []).map((row) => (
                <div key={row._id || row.value} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2">
                  <div>
                    <p className="font-bold">{row.label}</p>
                    {row.value && <p className="text-xs text-slate-500">{row.value}</p>}
                  </div>
                  {row._id && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setOptionManager({ ...optionManager, editing: row, form: { label: row.label, value: row.value || '' } })}><Pencil size={14} /></Button>
                      <Button size="sm" variant="danger" onClick={() => deleteOption(row)}><Trash2 size={14} /></Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
