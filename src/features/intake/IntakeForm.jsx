import { Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api.js';
import { calculateAge, clinicToday, errorMessage } from '../../utils/format.js';
import { cnicError, formatCnicInput, formatPhoneInput, nameError, phoneError } from '../../utils/identity.js';
import { Button, Field, Modal, PageHeader, Spinner, TextArea, TextInput } from '../../components/common/ui.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import { useToast } from '../../components/common/ui.jsx';

const schema = z.object({
  fullName: z.string().trim().superRefine((value, ctx) => {
    const message = nameError(value);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }),
  contactNumber: z.string().trim().superRefine((value, ctx) => {
    const message = phoneError(value);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }),
  cnic: z.string().trim().superRefine((value, ctx) => {
    const message = cnicError(value);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }),
  dateOfBirth: z.string().min(10, 'Date of birth is required').refine((value) => value <= clinicToday(), 'Date of birth cannot be in the future').refine((value) => {
    const age = calculateAge(value);
    return age !== '' && age <= 120;
  }, 'Enter a date of birth within the last 120 years'),
  gender: z.string().min(1, 'Select a gender'),
  nationality: z.string().min(1, 'Nationality is required'),
  occupation: z.string().min(1, 'Occupation is required'),
  occupationOther: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  address: z.string().trim().min(3, 'Address is required'),
  weightKg: z.coerce.number({ invalid_type_error: 'Enter weight in kg' }).gt(0, 'Weight must be above 0 kg').max(400, 'Weight cannot be above 400 kg'),
  heightCm: z.coerce.number({ invalid_type_error: 'Enter height in cm' }).gt(30, 'Height must be above 30 cm').max(250, 'Height cannot be above 250 cm'),
  referredBy: z.string().min(1, 'Referral source is required'),
  referredByOther: z.string().optional(),
  doctorId: z.string().min(1, 'Select a doctor'),
  procedureId: z.string().min(1, 'Select a procedure'),
  formDate: z.string().min(10, 'Form date is required').refine((value) => value <= clinicToday(), 'Form date cannot be in the future'),
  policyAcknowledged: z.literal(true, { errorMap: () => ({ message: 'Policy acknowledgement is required' }) }),
  anesthesiaType: z.string().optional(),
  diet: z.string().optional(),
  bloodTestStatus: z.string().optional(),
  surgeryCost: z.string().optional(),
  followUpSessions: z.string().optional(),
  locationOfSurgery: z.string().optional(),
  mri: z.string().optional(),
  anyOther: z.string().optional(),
});

function optionsOf(items) {
  return (items || []).map((item) => ({ value: item.value, label: item.label, allowOther: item.allowOther, ...item }));
}

const genders = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];
const weights = Array.from({ length: 151 }, (_, index) => {
  const kg = 30 + index;
  return { value: String(kg), label: `${kg} kg` };
});
const heights = Array.from({ length: 91 }, (_, index) => {
  const cm = 120 + index;
  return { value: String(cm), label: `${cm} cm` };
});
const followUpOptions = Array.from({ length: 13 }, (_, index) => ({ value: String(index), label: `${index} session${index === 1 ? '' : 's'}` }));

export default function IntakeForm({ departmentCode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
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
  const [skinValues, setSkinValues] = useState({});
  const [conflictOpen, setConflictOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { formDate: clinicToday(), gender: '', policyAcknowledged: false, nationality: '', occupation: '', city: '', referredBy: '', doctorId: '', procedureId: '', weightKg: '', heightCm: '', followUpSessions: '' },
  });
  const { register, handleSubmit, watch, setValue, formState: { errors } } = form;
  const dob = watch('dateOfBirth');
  const occupation = watch('occupation');
  const referredBy = watch('referredBy');
  const watchedName = watch('fullName');
  const watchedPhone = watch('contactNumber');
  const watchedCnic = watch('cnic');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const cached = (key, url, params) => queryClient.fetchQuery({
          queryKey: key,
          queryFn: () => api.get(url, params),
          staleTime: 5 * 60_000,
        });
        const [departments, policyBody, occupationBody, nationalityBody, cityBody, referralBody] = await Promise.all([
          cached(['departments', 'active'], '/departments', { active: 'true' }),
          cached(['policy', 'current'], '/policy/current'),
          cached(['master-data', 'OCCUPATION'], '/master-data', { type: 'OCCUPATION', active: 'true' }),
          cached(['master-data', 'NATIONALITY'], '/master-data', { type: 'NATIONALITY', active: 'true' }),
          cached(['master-data', 'CITY'], '/master-data', { type: 'CITY', active: 'true' }),
          cached(['master-data', 'REFERRAL_SOURCE'], '/master-data', { type: 'REFERRAL_SOURCE', active: 'true' }),
        ]);
        const department = departments.data.find((item) => item.code === departmentCode);
        const [doctorBody, procedureBody, extra] = await Promise.all([
          cached(['directory-doctors', departmentCode], '/directory/doctors', { departmentId: String(department._id || department.id), limit: '100' }),
          cached(['procedures', departmentCode], '/procedures', { departmentCode, active: 'true' }),
          departmentCode === 'SKIN'
            ? cached(['master-data', 'SKIN_FIELD'], '/master-data', { type: 'SKIN_FIELD', active: 'true' })
            : Promise.all(['ANESTHESIA_TYPE', 'DIET', 'BLOOD_TEST_STATUS', 'SURGERY_LOCATION', 'MRI_STATUS'].map((type) => cached(['master-data', type], '/master-data', { type, active: 'true' }))),
        ]);
        if (!active) return;
        const surgery = {};
        if (departmentCode === 'SURGERY') {
          ['anesthesia', 'diet', 'blood', 'location', 'mri'].forEach((key, index) => { surgery[key] = extra[index].data; });
        }
        setCatalog({
          occupations: occupationBody.data,
          nationalities: nationalityBody.data,
          cities: cityBody.data,
          referrals: referralBody.data,
          skinFields: departmentCode === 'SKIN' ? extra.data : [],
          surgery,
        });
        setDoctors(doctorBody.data);
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

  const age = useMemo(() => calculateAge(dob), [dob]);

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
        dateOfBirth: values.dateOfBirth,
        gender: values.gender,
        nationality: values.nationality,
        occupation: values.occupation,
        occupationOther: values.occupationOther || '',
        city: values.city,
        address: values.address,
      },
      visit: {
        weightKg: Number(values.weightKg),
        heightCm: Number(values.heightCm),
        referredBy: values.referredBy,
        referredByOther: values.referredByOther || '',
        doctorId: values.doctorId,
        procedureId: values.procedureId,
        formDate: values.formDate,
      },
    };
    if (departmentCode === 'SKIN') {
      payload.skinDetails = { fields: (catalog.skinFields || []).map((field) => ({ key: field.value, value: skinValues[field.value] || '' })) };
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
      };
    }
    setSubmitting(true);
    try {
      const body = await api.post('/submissions', payload);
      toast.success(`Your form submitted successfully. ${body.data.patient.patientCode}`);
      const submissionBase = location.pathname.startsWith('/admin') ? '/admin/submissions' : '/manager/submissions';
      navigate(`${submissionBase}/${body.data.submission.id}`);
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

  if (loading) return <Spinner label="Loading form" />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <PageHeader title={departmentCode === 'SKIN' ? 'Skin department form' : 'Surgery department form'} text="Register a visit. The same name, CNIC, and mobile number stay one person, including a visit in the other department." />
      <section className="card space-y-4 p-5">
        <h2 className="text-xl font-bold text-ink-900">Identification</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Contact number" error={errors.contactNumber?.message}>
            <TextInput inputMode="tel" autoComplete="tel" placeholder="0300 1234567" value={watchedPhone || ''} onChange={(event) => setValue('contactNumber', formatPhoneInput(event.target.value), { shouldValidate: true })} />
          </Field>
          <Field label="Patient name" error={errors.fullName?.message}>
            <TextInput autoComplete="name" placeholder="Full name" value={watchedName || ''} onChange={(event) => setValue('fullName', event.target.value, { shouldValidate: true })} />
          </Field>
          <Field label="CNIC" error={errors.cnic?.message}>
            <TextInput autoComplete="off" placeholder="12345-1234567-1" value={watchedCnic || ''} onChange={(event) => setValue('cnic', formatCnicInput(event.target.value), { shouldValidate: true })} />
          </Field>
        </div>
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
      </section>

      <section className="card grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <h2 className="text-xl font-bold text-ink-900 sm:col-span-2">Personal details</h2>
        <Field label="Date of birth" error={errors.dateOfBirth?.message}><TextInput type="date" max={clinicToday()} {...register('dateOfBirth')} /></Field>
        <Field label="Age"><TextInput value={age} readOnly /></Field>
        <SearchableSelect label="Gender" options={genders} value={watch('gender')} onChange={(value) => setValue('gender', value, { shouldValidate: true })} error={errors.gender?.message} placeholder="Gender" />
        <SearchableSelect label="Nationality" allowCustom options={optionsOf(catalog.nationalities)} value={watch('nationality')} onChange={(value) => setValue('nationality', value, { shouldValidate: true })} error={errors.nationality?.message} placeholder="Nationality" />
        <SearchableSelect label="Occupation" allowCustom options={optionsOf(catalog.occupations)} value={occupation} onChange={(value) => setValue('occupation', value, { shouldValidate: true })} error={errors.occupation?.message} placeholder="Occupation" />
        {catalog.occupations?.find((item) => item.value === occupation)?.allowOther && <Field label="Other occupation"><TextInput {...register('occupationOther')} /></Field>}
        <SearchableSelect label="Weight (kg)" allowCustom customKind="number" customExclusiveMin={0} customMax={400} unit="kg" options={weights} value={watch('weightKg') ? String(watch('weightKg')) : ''} onChange={(value) => setValue('weightKg', value, { shouldValidate: true })} error={errors.weightKg?.message} placeholder="Weight" />
        <SearchableSelect label="Height (cm)" allowCustom customKind="number" customExclusiveMin={30} customMax={250} unit="cm" options={heights} value={watch('heightCm') ? String(watch('heightCm')) : ''} onChange={(value) => setValue('heightCm', value, { shouldValidate: true })} error={errors.heightCm?.message} placeholder="Height" />
        <SearchableSelect label="City" allowCustom options={optionsOf(catalog.cities)} value={watch('city')} onChange={(value) => setValue('city', value, { shouldValidate: true })} error={errors.city?.message} placeholder="City" />
        <Field label="Address" error={errors.address?.message}><TextInput {...register('address')} /></Field>
      </section>

      <section className="card grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <h2 className="text-xl font-bold text-ink-900 sm:col-span-2">Visit</h2>
        <SearchableSelect label="Doctor" options={doctors.map((doctor) => ({ value: String(doctor.id || doctor._id), label: doctor.fullName }))} value={watch('doctorId')} onChange={(value) => setValue('doctorId', value, { shouldValidate: true })} error={errors.doctorId?.message} placeholder="Doctor" />
        <SearchableSelect label="Procedure" options={procedures.map((procedure) => ({ value: String(procedure._id || procedure.id), label: procedure.name }))} value={watch('procedureId')} onChange={(value) => setValue('procedureId', value, { shouldValidate: true })} error={errors.procedureId?.message} placeholder="Procedure" />
        <SearchableSelect label="Referred by" allowCustom options={optionsOf(catalog.referrals)} value={referredBy} onChange={(value) => setValue('referredBy', value, { shouldValidate: true })} error={errors.referredBy?.message} placeholder="Referral" />
        {catalog.referrals?.find((item) => item.value === referredBy)?.allowOther && <Field label="Other referral"><TextInput {...register('referredByOther')} /></Field>}
        <Field label="Form date" error={errors.formDate?.message}><TextInput type="date" max={clinicToday()} {...register('formDate')} /></Field>
      </section>

      {departmentCode === 'SKIN' ? (
        <section className="card space-y-4 p-5">
          <h2 className="text-xl font-bold text-ink-900">Skin details</h2>
          <p className="text-base font-bold text-slate-600">Extra skin fields appear here after an administrator adds them in Master Data.</p>
          {(catalog.skinFields || []).length === 0 && <p className="text-base font-bold text-slate-600">No skin fields have been configured yet.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {(catalog.skinFields || []).map((field) => (
              <Field key={field.value} label={`${field.label}${field.metadata?.pendingConfirmation === false ? '' : ' (pending confirmation)'}`}>
                <TextInput value={skinValues[field.value] || ''} onChange={(event) => setSkinValues((current) => ({ ...current, [field.value]: event.target.value }))} />
              </Field>
            ))}
          </div>
        </section>
      ) : (
        <section className="card grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <h2 className="text-xl font-bold text-ink-900 sm:col-span-2">Surgery details</h2>
          <SearchableSelect label="Anesthesia type" allowCustom options={optionsOf(catalog.surgery?.anesthesia)} value={watch('anesthesiaType')} onChange={(value) => setValue('anesthesiaType', value)} placeholder="Anesthesia" />
          <SearchableSelect label="Diet" allowCustom options={optionsOf(catalog.surgery?.diet)} value={watch('diet')} onChange={(value) => setValue('diet', value)} placeholder="Diet" />
          <SearchableSelect label="Blood test status" allowCustom options={optionsOf(catalog.surgery?.blood)} value={watch('bloodTestStatus')} onChange={(value) => setValue('bloodTestStatus', value)} placeholder="Blood test" />
          <SearchableSelect label="Location of surgery" allowCustom options={optionsOf(catalog.surgery?.location)} value={watch('locationOfSurgery')} onChange={(value) => setValue('locationOfSurgery', value)} placeholder="Location" />
          <SearchableSelect label="MRI" allowCustom options={optionsOf(catalog.surgery?.mri)} value={watch('mri')} onChange={(value) => setValue('mri', value)} placeholder="MRI" />
          <Field label="Surgery cost"><TextInput type="number" min="0" {...register('surgeryCost')} /></Field>
          <SearchableSelect label="Follow-up sessions" allowCustom customKind="number" customInteger customMin={0} customMax={500} options={followUpOptions} value={watch('followUpSessions') ? String(watch('followUpSessions')) : ''} onChange={(value) => setValue('followUpSessions', value)} placeholder="Sessions" />
          <Field label="Any other"><TextArea {...register('anyOther')} /></Field>
        </section>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="text-xl font-bold text-ink-900">{policy?.title} · version {policy?.version}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          {policy?.items?.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" {...register('policyAcknowledged')} />
          <span>The patient has acknowledged this policy. The manager identity, time, and policy version will be stored.</span>
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
              <Button onClick={() => { setAckConflict(true); setMode('new'); setConflictOpen(false); }}>Register as a different person</Button>
            </div>
          </div>
        )}
        {identity?.status === 'CNIC_NAME_CONFLICT' && (
          <div className="space-y-3 text-sm">
            <p>This CNIC belongs to {identity.cnicConflict?.patientCode} ({identity.cnicConflict?.fullName}). The name does not match. Correct the record or cancel.</p>
            <Field label="Why is the name being corrected?"><TextInput value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConflictOpen(false)}>Cancel</Button>
              <Button onClick={() => { setCorrecting(true); setMode('attach'); setExistingId(identity.cnicConflict.id); setConflictOpen(false); }}>Use the existing patient</Button>
            </div>
          </div>
        )}
        {identity?.exactMatch && (
          <div className="space-y-3 text-sm">
            <p>Patient already exists: {identity.exactMatch.patientCode}. Continue to attach this procedure.</p>
            <div className="flex justify-end"><Button onClick={() => setConflictOpen(false)}>Continue</Button></div>
          </div>
        )}
      </Modal>
    </form>
  );
}
