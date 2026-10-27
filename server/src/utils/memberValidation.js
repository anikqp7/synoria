function validateMemberInput(data, role, { requirePassword = true } = {}) {
  const { name, email, phone, password } = data;
  if (![name, email, phone].every(value => typeof value === 'string')) return { error: 'Name, email and phone are required.' };
  if (!name.trim() || name.trim().length > 120) return { error: 'Enter a name with up to 120 characters.' };
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return { error: 'Enter a valid email address.' };
  if (!/^[+\d() .-]{7,30}$/.test(phone.trim()) || phone.replace(/\D/g, '').length < 7) return { error: 'Enter a valid phone number with at least 7 digits.' };
  const hasPassword = password !== undefined && password !== '';
  if ((requirePassword || hasPassword) && (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72)) return { error: 'Password must be at least 8 characters and at most 72 bytes.' };
  const fields = { name: name.trim(), email: normalizedEmail, phone: phone.trim() };
  if (role === 'student') {
    const { studentId, batch = '', academicSession = '' } = data;
    if (![studentId, batch, academicSession].every(value => typeof value === 'string') || !studentId.trim() || [studentId, batch, academicSession].some(value => value.trim().length > 50)) return { error: 'Enter a student ID, batch and academic session with up to 50 characters each.' };
    Object.assign(fields, { studentId: studentId.trim(), batch: batch.trim(), academicSession: academicSession.trim() });
  } else {
    const { designation = '', researchInterests = '' } = data;
    if (typeof designation !== 'string' || typeof researchInterests !== 'string' || designation.trim().length > 100 || researchInterests.trim().length > 500) return { error: 'Check the designation and research interests lengths.' };
    Object.assign(fields, { designation: designation.trim(), researchInterests: researchInterests.trim() });
  }
  return { fields, password: hasPassword ? password : undefined };
}

module.exports = { validateMemberInput };
