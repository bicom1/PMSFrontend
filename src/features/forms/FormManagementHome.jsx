import { Link } from 'react-router-dom';
import { ScanFace, Syringe } from 'lucide-react';
import { PageHeader } from '../../components/common/ui.jsx';

export default function FormManagementHome({ base = '/manager/form-management' }) {
  return (
    <div>
      <PageHeader title="Form Management" text="Choose the department. Manage the fields used on that patient form." />
      <div className="grid gap-4 md:grid-cols-2">
        <Link to={`${base}/skin`} className="card flex gap-4 p-6 transition duration-200 hover:border-brand-600 hover:bg-teal-50/40">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-brand-700"><ScanFace size={28} /></span>
          <span>
            <p className="text-sm font-bold uppercase tracking-wide text-teal-700">SKN</p>
            <h2 className="mt-1 text-3xl font-bold text-ink-900">Skin Department</h2>
            <p className="mt-2 text-base text-slate-600">Edit, delete, or add fields for the Skin patient form.</p>
          </span>
        </Link>
        <Link to={`${base}/surgery`} className="card flex gap-4 p-6 transition duration-200 hover:border-brand-600 hover:bg-teal-50/40">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-brand-700"><Syringe size={28} /></span>
          <span>
            <p className="text-sm font-bold uppercase tracking-wide text-teal-700">SRG</p>
            <h2 className="mt-1 text-3xl font-bold text-ink-900">Surgery Department</h2>
            <p className="mt-2 text-base text-slate-600">Edit, delete, or add fields for the Surgery patient form.</p>
          </span>
        </Link>
      </div>
    </div>
  );
}
