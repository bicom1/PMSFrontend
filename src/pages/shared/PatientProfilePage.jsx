import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api.js';
import { errorMessage } from '../../utils/format.js';
import { PageHeader, Spinner, useToast } from '../../components/common/ui.jsx';

export default function PatientProfilePage({ submissionBase }) {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  useEffect(() => {
    api.get(`/patients/${id}`).then((body) => {
      setData(body.data);
      return api.get('/submissions', { patientCode: body.data.patient.patientCode, limit: '50' });
    }).then((body) => setSubmissions(body.items)).catch((error) => toast.error(errorMessage(error)));
  }, [id, toast]);
  if (!data) return <Spinner />;
  const patient = data.patient;
  return (
    <div className="space-y-4">
      <PageHeader title={`${patient.patientCode} · ${patient.fullName}`} text={data.linked ? `Linked ${data.linked.departmentCode} record ${data.linked.patientCode}` : 'No verified cross-department link'} />
      <section className="card grid gap-3 p-5 text-sm md:grid-cols-2">
        {[['Phone', patient.contactNumber], ['CNIC', patient.cnic], ['Date of birth', patient.dateOfBirth], ['Age', patient.age], ['Gender', patient.gender], ['City', patient.city], ['Address', patient.address]].map(([label, value]) => (
          <div key={label}><p className="text-slate-400">{label}</p><p className="font-medium">{value || '—'}</p></div>
        ))}
      </section>
      <section className="card p-5">
        <h2 className="font-semibold">Procedures</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {submissions.map((item) => <li key={item.id}><Link className="text-brand-700" to={`${submissionBase}/${item.id}`}>{item.formDate} · {item.procedure} · {item.bookingStatus}</Link></li>)}
        </ul>
      </section>
    </div>
  );
}
