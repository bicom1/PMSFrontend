import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { api, openProtectedFile } from '../../services/api.js';
import { errorMessage } from '../../utils/format.js';
import { Button, PageHeader, Spinner, useToast } from '../../components/common/ui.jsx';

export default function PatientProfilePage({ submissionBase }) {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  useEffect(() => {
    api.get(`/patients/${id}`).then(async (body) => {
      setData(body.data);
      const codes = body.data.appointments?.length ? body.data.appointments : [{ patientCode: body.data.patient.patientCode }];
      const lists = await Promise.all(codes.map((item) => api.get('/submissions', { patientCode: item.patientCode, limit: '50' })));
      const wanted = new Set(codes.map((item) => item.patientCode));
      setSubmissions(lists.flatMap((list) => list.items || []).filter((item) => wanted.has(item.patientCode)));
    }).catch((error) => toast.error(errorMessage(error)));
  }, [id, toast]);
  if (!data) return <Spinner />;
  const patient = data.patient;
  const appointments = data.appointments?.length ? data.appointments : [{ id: patient.id, patientCode: patient.patientCode, departmentCode: patient.departmentCode }];
  const label = (code) => (code === 'SKIN' ? 'Skin' : code === 'SURGERY' ? 'Surgery' : code);
  return (
    <div className="space-y-4">
      <PageHeader
        title={`${patient.patientCode} · ${patient.fullName}`}
        text={appointments.length > 1 ? 'This person has a Skin form and a Surgery form.' : `${label(patient.departmentCode)} form only.`}
        actions={<Button variant="secondary" onClick={() => openProtectedFile(`/patients/${patient.id}/history.pdf`, { downloadName: `${appointments.map((item) => item.patientCode).join('-')}-medical-history.pdf`, mimeType: 'application/pdf' }).catch((error) => toast.error(errorMessage(error)))}><Download size={18} /> Download medical history</Button>}
      />
      {appointments.length > 1 && (
        <div className="rounded-2xl bg-teal-50 px-4 py-3 text-base font-bold text-teal-950">
          {appointments.map((item) => <p key={item.id}>{label(item.departmentCode)} form · {item.patientCode}</p>)}
        </div>
      )}
      <section className="card grid gap-3 p-5 text-sm md:grid-cols-2">
        {[['Phone', patient.contactNumber], ['CNIC', patient.cnic], ['Date of birth', patient.dateOfBirth], ['Age', patient.age], ['Gender', patient.gender], ['City', patient.city], ['Address', patient.address]].map(([labelName, value]) => (
          <div key={labelName}><p className="text-slate-400">{labelName}</p><p className="font-bold">{value || '—'}</p></div>
        ))}
      </section>
      {appointments.map((appointment) => (
        <section key={appointment.id} className="card p-5">
          <h2 className="font-bold">{label(appointment.departmentCode)} form · {appointment.patientCode}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {submissions.filter((item) => item.patientCode === appointment.patientCode).map((item) => <li key={item.id}><Link className="font-bold text-brand-700" to={`${submissionBase}/${item.id}`}>{item.formDate} · {item.procedure} · {item.bookingStatus}</Link></li>)}
            {submissions.filter((item) => item.patientCode === appointment.patientCode).length === 0 && <li className="font-bold text-slate-500">No form in this department yet.</li>}
          </ul>
        </section>
      ))}
    </div>
  );
}
