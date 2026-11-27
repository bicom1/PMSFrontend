export function formatPhoneInput(value) {
  const raw = String(value || '');
  const hasPlus = raw.trim().startsWith('+');
  let digits = raw.replace(/\D/g, '').slice(0, 15);
  const looksPakistan = !hasPlus && (
    digits.startsWith('03')
    || (digits.startsWith('3') && digits.length <= 10)
    || (digits.startsWith('923') && digits.length > 4)
  );
  if (looksPakistan) {
    if (digits.startsWith('92')) digits = `0${digits.slice(2)}`;
    if (digits.length === 10 && digits.startsWith('3')) digits = `0${digits}`;
    digits = digits.slice(0, 11);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  if (!digits) return hasPlus ? '+' : '';
  return `${hasPlus ? '+' : ''}${digits}`;
}

export function formatCnicInput(value) {
  const compact = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  if (!compact) return '';
  if (/[A-Z]/.test(compact) || compact.length > 13) return compact;
  if (compact.length <= 5) return compact;
  if (compact.length <= 12) return `${compact.slice(0, 5)}-${compact.slice(5)}`;
  return `${compact.slice(0, 5)}-${compact.slice(5, 12)}-${compact.slice(12)}`;
}

export function phoneError(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return 'Phone number is required';
  if (digits.length < 7 || digits.length > 15) return 'Enter a phone number with 7 to 15 digits';
  return '';
}

export function cnicError(value) {
  const compact = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!compact) return 'CNIC or passport is required';
  if (/^\d+$/.test(compact)) {
    if (compact.length !== 13) return 'Enter the full 13-digit CNIC';
    if (/^(\d)\1{12}$/.test(compact)) return 'Enter the CNIC printed on the document';
    return '';
  }
  if (compact.length < 6 || compact.length > 20) return 'Enter a passport number with 6 to 20 characters';
  return '';
}

export function nameError(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2) return 'Patient name is required';
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(name)) return 'Use letters for the patient name';
  return '';
}
