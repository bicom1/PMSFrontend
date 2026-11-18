export default function ClinicLogo({ className = 'h-28 w-28' }) {
  return <img src="/enfield-logo.png" alt="Enfield Royal Clinics" width="160" height="160" className={`object-contain ${className}`} />;
}

export function BootScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-950">
      <ClinicLogo className="h-40 w-40" />
    </div>
  );
}
