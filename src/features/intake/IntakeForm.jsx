import { Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api.js';
import { calculateAge, clinicToday, errorMessage } from '../../utils/format.js';
import { cnicError, formatCnicInput, formatPhoneInput, nameError, phoneError } from '../../utils/identity.js';
import { Button, Field, Modal, PageHeader, Spinner, TextArea, TextInput, useToast } from '../../components/common/ui.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';

function optionsOf(items) {
  return (items || []).map((item) => ({
    value: String(item.value || item._id || item.id),
    label: item.label || item.name || item.fullName,
    allowOther: item.allowOther,
  }));
}

const weights = Array.from({ length: 151 }, (_, index) => {
  const kg = 30 + index;
  return { value: String(kg), label: `${kg} kg` };
});
const heights = Array.from({ length: 61 }, (_, index) => {
  const inches = 36 + index;
  return { value: String(inches), label: `${inches} in` };
});
const followUpOptions = Array.from({ length: 13 }, (_, index) => ({ value: String(index), label: `${index} session${index === 1 ? '' : 's'}` }));
const genders = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

function buildSchema(fields) {
  const shape = {
    policyAcknowledged: z.literal(true, { errorMap: () => ({ message: 'Policy acknowledgement is required' }) }),
    occupationOther: z.string().optional(),
    referredByOther: z.string().optional(),
  };
  const byKey = new Map((fields || []).map((field) => [field.key, field]));
  const optionalString = z.string().optional().or(z.literal(''));

  const active = (key) => byKey.has(key);
  const required = (key) => active(key) && byKey.get(key)?.required;

  shape.fullName = required('fullName')
    ? z.string().trim().superRefine((value, ctx) => {
      const message = nameError(value);
      if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    })
    : optionalString;
  shape.contactNumber = required('contactNumber')
    ? z.string().trim().superRefine((value, ctx) => {
      const message = phoneError(value);
      if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    })
    : optionalString;
  shape.cnic = required('cnic')
    ? z.string().trim().superRefine((value, ctx) => {
      const message = cnicError(value);
      if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    })
    : optionalString;

  shape.dateOfBirth = required('dateOfBirth')
    ? z.string().min(10, 'Date of birth is required').refine((value) => value <= clinicToday(), 'Date of birth cannot be in the future')
    : optionalString;
  shape.gender = required('gender') ? z.string().min(1, 'Select a gender') : optionalString;
  shape.nationality = required('nationality') ? z.string().min(1, 'Nationality is required') : optionalString;
  shape.occupation = required('occupation') ? z.string().min(1, 'Occupation is required') : optionalString;
  shape.city = required('city') ? z.string().min(1, 'City is required') : optionalString;
  shape.address = required('address') ? z.string().trim().min(3, 'Address is required') : optionalString;

  shape.weightKg = required('weightKg')
    ? z.coerce.number({ invalid_type_error: 'Enter weight in kg' }).gt(0).max(400)
    : z.union([z.coerce.number().gt(0).max(400), z.literal(''), z.nan()]).optional();
  shape.heightCm = required('heightCm')
    ? z.coerce.number({ invalid_type_error: 'Enter height in inches' }).gt(36).max(96)
    : z.union([z.coerce.number().gt(36).max(96), z.literal(''), z.nan()]).optional();

  shape.referredBy = required('referredBy') ? z.string().min(1, 'Referral source is required') : optionalString;
  shape.doctorId = required('doctorId') ? z.string().min(1, 'Select a doctor') : optionalString;
  shape.procedureId = required('procedureId') ? z.string().min(1, 'Select a procedure') : optionalString;
  shape.formDate = required('formDate')
    ? z.string().min(10, 'Form date is required').refine((value) => value <= clinicToday(), 'Form date cannot be in the future')
    : optionalString;
  shape.anesthesiaType = optionalString;
  shape.diet = optionalString;
  shape.bloodTestStatus = optionalString;
  shape.surgeryCost = optionalString;
  shape.followUpSessions = optionalString;
  shape.locationOfSurgery = optionalString;
  shape.mri = optionalString;
  shape.anyOther = optionalString;
  return z.object(shape);
}

const SECTION_TITLE = {
  identification: 'Identification',
  personal: 'Personal details',
  visit: 'Visit (clinic staff)',
  details: 'Department details',
};

export default function IntakeForm({ departmentCode }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [formFields, setFormFields] = useState([]);
  const [catalog, setCatalog] = useState({});
  const [doctors, setDoctors] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [mode, setMode] = useState('new');
  const [existingId, setExistingId] = useState('');
  const [ackConflict, setAckConflict] = useState(false);
  const [linkIdentity, setLinkIdentity] = useState(false);
  const [acceptPhone, setAcceptPhone] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [reason, setReason] = useState('');
  const [customValues, setCustomValues] = useState({});
  const [conflictOpen, setConflictOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeFields = useMemo(() => (formFields || []).filter((field) => field.isActive !== false), [formFields]);
  const schema = useMemo(() => buildSchema(activeFields), [activeFields]);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      formDate: clinicToday(),
      gender: '',
      policyAcknowledged: false,
      nationality: '',
      occupation: '',
      city: '',
      referredBy: '',
      doctorId: '',
      procedureId: '',
      weightKg: '',
      heightCm: '',
      followUpSessions: '',
      dateOfBirth: '',
      address: '',
      fullName: '',
      contactNumber: '',
      cnic: '',
    },
  });
  const { register, handleSubmit, watch, setValue, formState: { errors } } = form;
  const dob = watch('dateOfBirth');
  const occupation = watch('occupation');
  const referredBy = watch('referredBy');
  const watchedName = watch('fullName');
  const watchedPhone = watch('contactNumber');
  const watchedCnic = watch('cnic');
  const age = useMemo(() => calculateAge(dob), [dob]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const cached = (key, url, params) => queryClient.fetchQuery({
          queryKey: key,
          queryFn: () => api.get(url, params),
          staleTime: 5 * 60_000,
        });
        const [departments, policyBody, fieldBody, occupationBody, nationalityBody, cityBody, referralBody] = await Promise.all([
          cached(['departments', 'active'], '/departments', { active: 'true' }),
          cached(['policy', 'current', departmentCode], '/policy/current', { departmentCode }),
          api.get('/form-fields', { departmentCode, active: 'true' }),
          cached(['master-data', 'OCCUPATION'], '/master-data', { type: 'OCCUPATION', active: 'true' }),
          cached(['master-data', 'NATIONALITY'], '/master-data', { type: 'NATIONALITY', active: 'true' }),
          cached(['master-data', 'CITY'], '/master-data', { type: 'CITY', active: 'true' }),
          cached(['master-data', 'REFERRAL_SOURCE'], '/master-data', { type: 'REFERRAL_SOURCE', active: 'true' }),
        ]);
        const department = departments.data.find((item) => item.code === departmentCode);
        if (!department) throw new Error('Department was not found');
        const departmentId = String(department._id || department.id);
        const [doctorBody, procedureBody, surgeryLists] = await Promise.all([
          api.get('/directory/doctors', { departmentCode, limit: '100' }),
          cached(['procedures', departmentCode], '/procedures', { departmentCode, active: 'true' }),
          departmentCode === 'SURGERY'
            ? Promise.all(['ANESTHESIA_TYPE', 'DIET', 'BLOOD_TEST_STATUS', 'SURGERY_LOCATION', 'MRI_STATUS'].map((type) => cached(['master-data', type], '/master-data', { type, active: 'true' })))
            : Promise.resolve([]),
        ]);
        if (!active) return;
        let doctorList = (doctorBody.data || []).filter((doctor) => (doctor.departments || []).some((item) => String(item.id || item._id) === departmentId || item.code === departmentCode));
        if (!doctorList.length) {
          const allDoctors = await api.get('/directory/doctors', { limit: '100' });
          doctorList = (allDoctors.data || []).filter((doctor) => (doctor.departments || []).some((item) => String(item.id || item._id) === departmentId || item.code === departmentCode));
        }
        const surgery = {};
        if (departmentCode === 'SURGERY') {
          ['anesthesia', 'diet', 'blood', 'location', 'mri'].forEach((key, index) => { surgery[key] = surgeryLists[index].data; });
        }
        setFormFields(fieldBody.data || []);
        setCatalog({
          occupations: occupationBody.data,
          nationalities: nationalityBody.data,
          cities: cityBody.data,
          referrals: referralBody.data,
          surgery,
          GENDER: genders,
          WEIGHT: weights,
          HEIGHT: heights,
          FOLLOW_UP: followUpOptions,
          NATIONALITY: nationalityBody.data,
          OCCUPATION: occupationBody.data,
          CITY: cityBody.data,
          REFERRAL_SOURCE: referralBody.data,
          ANESTHESIA_TYPE: surgery.anesthesia || [],
          DIET: surgery.diet || [],
          BLOOD_TEST_STATUS: surgery.blood || [],
          SURGERY_LOCATION: surgery.location || [],
          MRI_STATUS: surgery.mri || [],
        });
        setDoctors(doctorList);
        setProcedures(procedureBody.data);
        setPolicy(policyBody.data);
        const pakistan = nationalityBody.data.find((item) => item.value === 'pakistan');
        if (pakistan) setValue('nationality', pakistan.value);
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [departmentCode, queryClient, setValue, toast]);

  useEffect(() => {
    if (loading) return;
    setValue('formDate', form.getValues('formDate') || clinicToday());
  }, [loading, form, setValue]);

  function fillKnownDetails(record) {
    ['dateOfBirth', 'gender', 'nationality', 'occupation', 'occupationOther', 'city', 'address'].forEach((key) => {
      if (!form.getValues(key) && record?.[key]) setValue(key, record[key], { shouldValidate: true });
    });
  }

  async function checkIdentity() {
    const values = form.getValues();
    if (nameError(values.fullName) || phoneError(values.contactNumber) || cnicError(values.cnic)) return;
    try {
      const body = await api.post('/patients/identify', {
        departmentCode,
        fullName: values.fullName,
        contactNumber: values.contactNumber,
        cnic: values.cnic,
      });
      setIdentity(body.data);
      if (body.data.exactMatch) {
        applyMatch(body.data.exactMatch);
        setMode('attach');
        setExistingId(body.data.exactMatch.id);
        setAcceptPhone(body.data.status !== 'EXACT_PHONE_CHANGE');
      } else if (body.data.status === 'CNIC_NAME_CONFLICT') {
        setMode('attach');
        setExistingId(body.data.cnicConflict.id);
        setCorrecting(true);
        if (!correcting) setConflictOpen(true);
      } else if (body.data.status === 'PHONE_CONFLICT') {
        setMode('new');
        setExistingId('');
        if (!ackConflict) setConflictOpen(true);
      } else {
        setMode('new');
        setExistingId('');
      }
      if (body.data.crossDepartmentCandidate?.canAutoLink) {
        setLinkIdentity(true);
        fillKnownDetails(body.data.crossDepartmentCandidate);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  useEffect(() => {
    if (loading) return;
    if (nameError(watchedName) || phoneError(watchedPhone) || cnicError(watchedCnic)) return undefined;
    const timer = setTimeout(() => { checkIdentity(); }, 500);
    return () => clearTimeout(timer);
  }, [watchedName, watchedPhone, watchedCnic, loading, departmentCode]);

  function applyMatch(match) {
    ['fullName', 'contactNumber', 'cnic', 'dateOfBirth', 'gender', 'nationality', 'occupation', 'occupationOther', 'city', 'address'].forEach((key) => {
      if (match[key]) setValue(key, match[key]);
    });
  }

  function fieldOptions(field) {
    if (field.fieldType === 'doctor') return optionsOf(doctors);
    if (field.fieldType === 'procedure') return optionsOf(procedures);
    if (field.optionsSource && catalog[field.optionsSource]) return optionsOf(catalog[field.optionsSource]);
    if (field.metadata?.options?.length) return field.metadata.options.map((item) => ({ value: String(item), label: String(item) }));
    return [];
  }

  async function onSubmit(values) {
    if (identity?.status === 'PHONE_CONFLICT' && !ackConflict) {
      setConflictOpen(true);
      return;
    }
    if ((identity?.status === 'CNIC_NAME_CONFLICT' || correcting) && reason.trim().length < 5) {
      toast.error('Enter a correction reason of at least 5 characters.');
      return;
    }
    const occupationItem = catalog.occupations?.find((item) => item.value === values.occupation);
    if (occupationItem?.allowOther && !values.occupationOther?.trim()) {
      toast.error('Specify the other occupation.');
      return;
    }
    const referralItem = catalog.referrals?.find((item) => item.value === values.referredBy);
    if (referralItem?.allowOther && !values.referredByOther?.trim()) {
      toast.error('Specify the other referral source.');
      return;
    }
    const customFields = activeFields.filter((field) => !field.isSystem);
    const payload = {
      departmentCode,
      mode,
      existingPatientId: existingId || undefined,
      acknowledgePhoneConflict: ackConflict,
      confirmIdentityLink: linkIdentity,
      acceptPhoneUpdate: acceptPhone || identity?.status === 'EXACT_PHONE_CHANGE',
      correction: reason.trim() ? { reason: reason.trim() } : undefined,
      policyVersionId: policy.versionId,
      policyAcknowledged: true,
      patient: {
        fullName: values.fullName,
        contactNumber: values.contactNumber,
        cnic: values.cnic,
        dateOfBirth: values.dateOfBirth || '',
        gender: values.gender || '',
        nationality: values.nationality || '',
        occupation: values.occupation || '',
        occupationOther: values.occupationOther || '',
        city: values.city || '',
        address: values.address || '',
      },
      visit: {
        weightKg: values.weightKg === '' || values.weightKg == null || Number.isNaN(Number(values.weightKg)) ? null : Number(values.weightKg),
        heightCm: values.heightCm === '' || values.heightCm == null || Number.isNaN(Number(values.heightCm)) ? null : Number(values.heightCm),
        referredBy: values.referredBy || '',
        referredByOther: values.referredByOther || '',
        doctorId: values.doctorId || undefined,
        procedureId: values.procedureId || undefined,
        formDate: values.formDate || clinicToday(),
      },
    };
    const customPayload = customFields.map((field) => ({ key: field.key, value: customValues[field.key] || '' }));
    if (departmentCode === 'SKIN') {
      payload.skinDetails = { fields: customPayload };
    } else {
      payload.surgeryDetails = {
        anesthesiaType: values.anesthesiaType || '',
        diet: values.diet || '',
        bloodTestStatus: values.bloodTestStatus || '',
        locationOfSurgery: values.locationOfSurgery || '',
        mri: values.mri || '',
        anyOther: values.anyOther || '',
        surgeryCost: values.surgeryCost === '' || values.surgeryCost == null ? null : Number(values.surgeryCost),
        followUpSessions: values.followUpSessions === '' || values.followUpSessions == null ? null : Number(values.followUpSessions),
        fields: customPayload,
      };
    }
    setSubmitting(true);
    try {
      const body = await api.post('/submissions', payload);
      toast.success(`Form submitted. ${body.data.patient.patientCode}`);
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const chooser = location.pathname.startsWith('/admin/')
        ? '/admin/patients/new'
        : '/manager/patients/new';
      navigate(chooser, { replace: true });
      return;
    } catch (error) {
      const details = error.response?.data?.errors;
      if (details?.code === 'EXACT_MATCH' || details?.code === 'CNIC_NAME_CONFLICT') {
        setIdentity(details);
        if (details.exactMatch) {
          applyMatch(details.exactMatch);
          setMode('attach');
          setExistingId(details.exactMatch.id);
        }
        setConflictOpen(true);
      } else if (details?.code === 'PHONE_CONFLICT') {
        setIdentity(details);
        setConflictOpen(true);
      } else if (details?.code === 'POLICY_CHANGED') {
        setPolicy(details.policy);
        toast.error(errorMessage(error));
      } else {
        toast.error(errorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  function renderField(field) {
    if (field.key === 'contactNumber') {
      return (
        <Field key={field.key} label={field.label} error={errors.contactNumber?.message}>
          <TextInput inputMode="tel" autoComplete="tel" placeholder={field.placeholder || '0300 1234567'} value={watchedPhone || ''} onChange={(event) => setValue('contactNumber', formatPhoneInput(event.target.value), { shouldValidate: true })} />
        </Field>
      );
    }
    if (field.key === 'fullName') {
      return (
        <Field key={field.key} label={field.label} error={errors.fullName?.message}>
          <TextInput autoComplete="name" placeholder={field.placeholder || 'Full name'} value={watchedName || ''} onChange={(event) => setValue('fullName', event.target.value, { shouldValidate: true })} />
        </Field>
      );
    }
    if (field.key === 'cnic') {
      return (
        <Field key={field.key} label={field.label} error={errors.cnic?.message}>
          <TextInput autoComplete="off" placeholder={field.placeholder || '12345-1234567-1'} value={watchedCnic || ''} onChange={(event) => setValue('cnic', formatCnicInput(event.target.value), { shouldValidate: true })} />
        </Field>
      );
    }
    if (field.fieldType === 'age') {
      return <Field key={field.key} label={field.label}><TextInput value={age} readOnly /></Field>;
    }
    if (!field.isSystem) {
      const inputType = field.fieldType || 'text';
      if (inputType === 'select') {
        return (
          <SearchableSelect
            key={field.key}
            label={field.label}
            allowCustom={Boolean(field.allowCustom)}
            options={fieldOptions(field)}
            value={customValues[field.key] || ''}
            onChange={(value) => setCustomValues((current) => ({ ...current, [field.key]: value }))}
            placeholder={field.placeholder || field.label}
          />
        );
      }
      if (inputType === 'textarea') {
        return (
          <Field key={field.key} label={field.label}>
            <TextArea value={customValues[field.key] || ''} onChange={(event) => setCustomValues((current) => ({ ...current, [field.key]: event.target.value }))} />
          </Field>
        );
      }
      return (
        <Field key={field.key} label={field.label}>
          <TextInput
            type={inputType === 'number' || inputType === 'date' || inputType === 'tel' ? inputType : 'text'}
            value={customValues[field.key] || ''}
            onChange={(event) => setCustomValues((current) => ({ ...current, [field.key]: event.target.value }))}
            placeholder={field.placeholder || field.label}
          />
        </Field>
      );
    }
    if (field.fieldType === 'select' || field.fieldType === 'doctor' || field.fieldType === 'procedure') {
      return (
        <div key={field.key} className="space-y-1">
          <SearchableSelect
            label={field.label}
            allowCustom={Boolean(field.allowCustom)}
            customKind={field.optionsSource === 'WEIGHT' || field.optionsSource === 'HEIGHT' || field.optionsSource === 'FOLLOW_UP' ? 'number' : 'text'}
            customExclusiveMin={field.optionsSource === 'WEIGHT' ? 0 : field.optionsSource === 'HEIGHT' ? 36 : undefined}
            customMax={field.optionsSource === 'WEIGHT' ? 400 : field.optionsSource === 'HEIGHT' ? 96 : field.optionsSource === 'FOLLOW_UP' ? 500 : undefined}
            customInteger={field.optionsSource === 'FOLLOW_UP'}
            unit={field.unit || ''}
            options={fieldOptions(field)}
            value={watch(field.key) ? String(watch(field.key)) : ''}
            onChange={(value) => setValue(field.key, value, { shouldValidate: true })}
            error={errors[field.key]?.message}
            placeholder={field.placeholder || field.label}
          />
          {field.key === 'occupation' && catalog.occupations?.find((item) => item.value === occupation)?.allowOther && (
            <Field label="Other occupation"><TextInput {...register('occupationOther')} /></Field>
          )}
          {field.key === 'referredBy' && catalog.referrals?.find((item) => item.value === referredBy)?.allowOther && (
            <Field label="Other referral"><TextInput {...register('referredByOther')} /></Field>
          )}
          {field.key === 'doctorId' && !doctors.length && <p className="text-xs font-bold text-rose-600">No doctors are assigned to this department yet.</p>}
          {field.key === 'procedureId' && !procedures.length && <p className="text-xs font-bold text-rose-600">No procedures are available for this department yet.</p>}
        </div>
      );
    }
    if (field.fieldType === 'textarea') {
      return <Field key={field.key} label={field.label} error={errors[field.key]?.message}><TextArea {...register(field.key)} /></Field>;
    }
    return (
      <Field key={field.key} label={field.label} error={errors[field.key]?.message}>
        <TextInput
          type={field.fieldType === 'number' || field.fieldType === 'date' || field.fieldType === 'tel' ? field.fieldType : 'text'}
          max={field.fieldType === 'date' ? clinicToday() : undefined}
          {...register(field.key)}
          placeholder={field.placeholder || ''}
        />
      </Field>
    );
  }

  if (loading) return <Spinner label="Loading form" />;

  const sections = ['identification', 'personal', 'visit', 'details'].filter((section) => activeFields.some((field) => field.section === section));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <PageHeader title={departmentCode === 'SKIN' ? 'Skin department form' : 'Surgery department form'} text="Register a visit. The same name, CNIC, and mobile number stay one person, including a visit in the other department." />

      {sections.map((section) => (
        <section key={section} className={`card gap-4 p-4 sm:p-5 ${section === 'identification' || section === 'details' ? 'space-y-4' : 'grid sm:grid-cols-2'}`}>
          <h2 className={`text-xl font-bold text-ink-900 ${section === 'identification' || section === 'details' ? '' : 'sm:col-span-2'}`}>{SECTION_TITLE[section]}</h2>
          <div className={section === 'identification' ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : section === 'details' ? 'grid gap-4 md:grid-cols-2' : 'contents'}>
            {activeFields.filter((field) => field.section === section).map((field) => renderField(field))}
          </div>
          {section === 'identification' && (
            <>
              <Button variant="secondary" onClick={checkIdentity}>Check records</Button>
              {identity?.status === 'NEW' && !identity.crossDepartmentCandidate && (
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">No existing record in this department. Submitting will create a new patient ID.</div>
              )}
              {identity?.exactMatch && (
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  Patient already exists: {identity.exactMatch.patientCode}. This new procedure will be attached to the existing patient record.
                  {identity.status === 'EXACT_PHONE_CHANGE' && (
                    <label className="mt-2 flex items-center gap-2">
                      <input type="checkbox" checked={acceptPhone} onChange={(event) => setAcceptPhone(event.target.checked)} />
                      Update the saved contact number
                    </label>
                  )}
                </div>
              )}
              {identity?.crossDepartmentCandidate && (
                <label className="flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-950">
                  <input type="checkbox" className="mt-1" checked={linkIdentity} onChange={(event) => setLinkIdentity(event.target.checked)} disabled={!identity.crossDepartmentCandidate.canAutoLink} />
                  <span>
                    Same person. {identity.crossDepartmentCandidate.departmentCode} appointment {identity.crossDepartmentCandidate.patientCode} uses this name, CNIC, and mobile number.
                    {identity.crossDepartmentCandidate.canAutoLink ? ' Both appointments stay on one person. The saved details were copied into this form.' : ' The name or mobile number differs, so an administrator must link them.'}
                  </span>
                </label>
              )}
            </>
          )}
        </section>
      ))}

      <section className="card space-y-3 p-5">
        <h2 className="text-xl font-bold text-ink-900">{policy?.title}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          {policy?.items?.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" {...register('policyAcknowledged')} />
          <span>The patient has acknowledged this policy. The manager identity and time will be stored.</span>
        </label>
        {errors.policyAcknowledged && <p className="text-xs text-rose-600">{errors.policyAcknowledged.message}</p>}
        {correcting && <Field label="Correction reason"><TextInput value={reason} onChange={(event) => setReason(event.target.value)} /></Field>}
      </section>

      <div className="flex sm:justify-end">
        <Button type="submit" className="w-full sm:w-auto" disabled={submitting}><Send size={18} />{submitting ? 'Saving…' : 'Submit form'}</Button>
      </div>

      <Modal open={conflictOpen} title="Verify this identity" onClose={() => setConflictOpen(false)}>
        {identity?.status === 'PHONE_CONFLICT' && (
          <div className="space-y-3 text-sm">
            <p>The phone number matches existing patients. A shared phone does not prove this is the same person.</p>
            <ul className="space-y-2">
              {identity.phoneConflicts?.map((item) => (
                <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">{item.patientCode} · {item.fullName} · {item.cnicMasked}</li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConflictOpen(false)}>Cancel</Button>
              <Button onClick={() => { setAckConflict(true); setConflictOpen(false); }}>Continue as a new patient</Button>
            </div>
          </div>
        )}
        {(identity?.status === 'CNIC_NAME_CONFLICT' || identity?.exactMatch) && identity?.status !== 'PHONE_CONFLICT' && (
          <div className="space-y-3 text-sm">
            <p>Confirm this is the same person, or correct the identity details with a reason.</p>
            <Field label="Correction reason"><TextInput value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConflictOpen(false)}>Close</Button>
              <Button onClick={() => { setCorrecting(true); setConflictOpen(false); }}>Continue</Button>
            </div>
          </div>
        )}
      </Modal>
    </form>
  );
}
