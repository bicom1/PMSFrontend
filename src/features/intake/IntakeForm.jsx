import { Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../services/api.js';
import { calculateAge, clinicToday, errorMessage } from '../../utils/format.js';
import { Button, Field, Modal, PageHeader, Spinner, TextArea, TextInput } from '../../components/common/ui.jsx';
import SearchableSelect from '../../components/common/SearchableSelect.jsx';
import { useToast } from '../../components/common/ui.jsx';

const schema = z.object({
  fullName: z.string().trim().min(2, 'Patient name is required'),
  contactNumber: z.string().trim().min(7, 'Contact number is required'),
  cnic: z.string().trim().min(13, 'CNIC is required'),
  dateOfBirth: z.string().min(10, 'Date of birth is required'),
  gender: z.string().min(1, 'Select a gender'),
  nationality: z.string().min(1, 'Nationality is required'),
  occupation: z.string().min(1, 'Occupation is required'),
  occupationOther: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  address: z.string().trim().min(3, 'Address is required'),
  weightKg: z.coerce.number({ invalid_type_error: 'Enter weight in kg' }).gt(0).max(400),
  heightCm: z.coerce.number({ invalid_type_error: 'Enter height in cm' }).gt(30).max(250),
  referredBy: z.string().min(1, 'Referral source is required'),
  referredByOther: z.string().optional(),
  doctorId: z.string().min(1, 'Select a doctor'),
  procedureId: z.string().min(1, 'Select a procedure'),
  formDate: z.string().min(10, 'Form date is required'),
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

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [departments, policyBody, occupationBody, nationalityBody, cityBody, referralBody] = await Promise.all([
          api.get('/departments', { active: 'true' }),
          api.get('/policy/current'),
          api.get('/master-data', { type: 'OCCUPATION', active: 'true' }),
          api.get('/master-data', { type: 'NATIONALITY', active: 'true' }),
          api.get('/master-data', { type: 'CITY', active: 'true' }),
          api.get('/master-data', { type: 'REFERRAL_SOURCE', active: 'true' }),
        ]);
        const department = departments.data.find((item) => item.code === departmentCode);
        const [doctorBody, procedureBody, extra] = await Promise.all([
          api.get('/directory/doctors', { departmentId: String(department._id || department.id), limit: '100' }),
          api.get('/procedures', { departmentCode, active: 'true' }),
          departmentCode === 'SKIN'
            ? api.get('/master-data', { type: 'SKIN_FIELD', active: 'true' })
            : Promise.all(['ANESTHESIA_TYPE', 'DIET', 'BLOOD_TEST_STATUS', 'SURGERY_LOCATION', 'MRI_STATUS'].map((type) => api.get('/master-data', { type, active: 'true' }))),
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
  }, [departmentCode, setValue, toast]);

  const age = useMemo(() => calculateAge(dob), [dob]);

  useEffect(() => {
    if (loading) return;
    setValue('formDate', form.getValues('formDate') || clinicToday());
  }, [loading, form, setValue]);

  async function checkIdentity() {
    const values = form.getValues();
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
        setConflictOpen(true);
      } else if (body.data.status === 'PHONE_CONFLICT') {
        setMode('new');
        setExistingId('');
        setConflictOpen(true);
      } else {
        setMode('new');
        setExistingId('');
      }
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

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
      toast.success(body.data.returningPatient ? `Procedure added to ${body.data.patient.patientCode}` : `Registered ${body.data.patient.patientCode}`);
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
      <PageHeader title={departmentCode === 'SKIN' ? 'Skin department form' : 'Surgery department form'} text="Register a visit. A returning patient keeps the same department ID." />
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold text-ink-900">Identification</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Contact number" error={errors.contactNumber?.message}><TextInput {...register('contactNumber')} /></Field>
          <Field label="Patient name" error={errors.fullName?.message}><TextInput {...register('fullName')} /></Field>
          <Field label="CNIC" error={errors.cnic?.message}><TextInput placeholder="12345-1234567-1" {...register('cnic')} /></Field>
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
              Verified {identity.crossDepartmentCandidate.departmentCode} record {identity.crossDepartmentCandidate.patientCode} belongs to the same person.
              {identity.crossDepartmentCandidate.canAutoLink ? ' Link the records.' : ' Names differ, so an administrator must link them.'}
            </span>
          </label>
        )}
      </section>

      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <h2 className="md:col-span-2 font-semibold text-ink-900">Personal details</h2>
        <Field label="Date of birth" error={errors.dateOfBirth?.message}><TextInput type="date" {...register('dateOfBirth')} /></Field>
        <Field label="Age"><TextInput value={age} readOnly /></Field>
        <SearchableSelect label="Gender" options={genders} value={watch('gender')} onChange={(value) => setValue('gender', value, { shouldValidate: true })} error={errors.gender?.message} placeholder="Select gender" />
        <SearchableSelect label="Nationality" options={optionsOf(catalog.nationalities)} value={watch('nationality')} onChange={(value) => setValue('nationality', value, { shouldValidate: true })} error={errors.nationality?.message} placeholder="Select nationality" />
        <SearchableSelect label="Occupation" options={optionsOf(catalog.occupations)} value={occupation} onChange={(value) => setValue('occupation', value, { shouldValidate: true })} error={errors.occupation?.message} placeholder="Select occupation" />
        {catalog.occupations?.find((item) => item.value === occupation)?.allowOther && <Field label="Other occupation"><TextInput {...register('occupationOther')} /></Field>}
        <SearchableSelect label="Weight (kg)" options={weights} value={watch('weightKg') ? String(watch('weightKg')) : ''} onChange={(value) => setValue('weightKg', value, { shouldValidate: true })} error={errors.weightKg?.message} placeholder="Select weight" />
        <SearchableSelect label="Height (cm)" options={heights} value={watch('heightCm') ? String(watch('heightCm')) : ''} onChange={(value) => setValue('heightCm', value, { shouldValidate: true })} error={errors.heightCm?.message} placeholder="Select height" />
        <SearchableSelect label="City" options={optionsOf(catalog.cities)} value={watch('city')} onChange={(value) => setValue('city', value, { shouldValidate: true })} error={errors.city?.message} placeholder="Select city" />
        <Field label="Address" error={errors.address?.message}><TextInput {...register('address')} /></Field>
      </section>

      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <h2 className="md:col-span-2 font-semibold text-ink-900">Visit</h2>
        <SearchableSelect label="Doctor" options={doctors.map((doctor) => ({ value: String(doctor.id || doctor._id), label: doctor.fullName }))} value={watch('doctorId')} onChange={(value) => setValue('doctorId', value, { shouldValidate: true })} error={errors.doctorId?.message} placeholder="Select doctor" />
        <SearchableSelect label="Procedure" options={procedures.map((procedure) => ({ value: String(procedure._id || procedure.id), label: procedure.name }))} value={watch('procedureId')} onChange={(value) => setValue('procedureId', value, { shouldValidate: true })} error={errors.procedureId?.message} placeholder="Select procedure" />
        <SearchableSelect label="Referred by" options={optionsOf(catalog.referrals)} value={referredBy} onChange={(value) => setValue('referredBy', value, { shouldValidate: true })} error={errors.referredBy?.message} placeholder="Select referral" />
        {catalog.referrals?.find((item) => item.value === referredBy)?.allowOther && <Field label="Other referral"><TextInput {...register('referredByOther')} /></Field>}
        <Field label="Form date" error={errors.formDate?.message}><TextInput type="date" {...register('formDate')} /></Field>
      </section>

      {departmentCode === 'SKIN' ? (
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold text-ink-900">Skin details</h2>
          <p className="text-sm text-slate-500">Extra skin fields appear here after an administrator adds them in Master Data.</p>
          {(catalog.skinFields || []).length === 0 && <p className="text-sm text-slate-500">No skin fields have been configured yet.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            {(catalog.skinFields || []).map((field) => (
              <Field key={field.value} label={`${field.label}${field.metadata?.pendingConfirmation === false ? '' : ' (pending confirmation)'}`}>
                <TextInput value={skinValues[field.value] || ''} onChange={(event) => setSkinValues((current) => ({ ...current, [field.value]: event.target.value }))} />
              </Field>
            ))}
          </div>
        </section>
      ) : (
        <section className="card grid gap-4 p-5 md:grid-cols-2">
          <h2 className="md:col-span-2 font-semibold text-ink-900">Surgery details</h2>
          <SearchableSelect label="Anesthesia type" options={optionsOf(catalog.surgery?.anesthesia)} value={watch('anesthesiaType')} onChange={(value) => setValue('anesthesiaType', value)} placeholder="Select anesthesia" />
          <SearchableSelect label="Diet" options={optionsOf(catalog.surgery?.diet)} value={watch('diet')} onChange={(value) => setValue('diet', value)} placeholder="Select diet" />
          <SearchableSelect label="Blood test status" options={optionsOf(catalog.surgery?.blood)} value={watch('bloodTestStatus')} onChange={(value) => setValue('bloodTestStatus', value)} placeholder="Select blood test status" />
          <SearchableSelect label="Location of surgery" options={optionsOf(catalog.surgery?.location)} value={watch('locationOfSurgery')} onChange={(value) => setValue('locationOfSurgery', value)} placeholder="Select location" />
          <SearchableSelect label="MRI" options={optionsOf(catalog.surgery?.mri)} value={watch('mri')} onChange={(value) => setValue('mri', value)} placeholder="Select MRI status" />
          <Field label="Surgery cost"><TextInput type="number" min="0" {...register('surgeryCost')} /></Field>
          <SearchableSelect label="Follow-up sessions" options={followUpOptions} value={watch('followUpSessions') ? String(watch('followUpSessions')) : ''} onChange={(value) => setValue('followUpSessions', value)} placeholder="Select sessions" />
          <Field label="Any other"><TextArea {...register('anyOther')} /></Field>
        </section>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold text-ink-900">{policy?.title} · version {policy?.version}</h2>
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

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}><Send size={18} />{submitting ? 'Saving…' : 'Submit form'}</Button>
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
