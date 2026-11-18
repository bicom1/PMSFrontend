export function clinicToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function calculateAge(dateOfBirth) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth || '')) return '';
  const today = clinicToday();
  const [ty, tm, td] = today.split('-').map(Number);
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age < 0 ? '' : age;
}

export function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-PK', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Karachi',
  }).format(date);
}

export function roleLabel(role) {
  return { ADMIN: 'Administrator', CLINIC_MANAGER: 'Clinic Manager', DOCTOR: 'Doctor' }[role] || role;
}

export function errorMessage(error) {
  const data = error?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length) {
    const messages = data.errors.map((item) => item.message).filter(Boolean);
    if (messages.length) return messages.join(' ');
  }
  return data?.message || error?.message || 'Something went wrong';
}

export function bytes(size) {
  if (!size && size !== 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
