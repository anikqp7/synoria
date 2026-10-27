import * as Yup from 'yup';
import { researchInterestTags, validateResearchInterests } from './researchInterests.js';

export function fieldKey(element) { return element.name || element.id || element.dataset.validationKey; }
export function fieldValue(element, elements = [element]) {
  if (element.type === 'file') return element.files?.[0] || null;
  if (element.type === 'checkbox') return element.checked;
  if (element.type === 'radio') return elements.find(item => item.type === 'radio' && fieldKey(item) === fieldKey(element) && item.checked)?.value || '';
  return element.value;
}
export function formFields(form) { return [...form.elements].filter(element => ['INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName) && !element.matches(':disabled') && !element.readOnly); }
export function formValues(form) { const elements = formFields(form); return Object.fromEntries(elements.map(element => [fieldKey(element), fieldValue(element, elements)])); }
function labelFor(element) {
  const label = element.getAttribute('aria-label') || [...(element.labels || [])].map(label => { const copy = label.cloneNode(true); copy.querySelectorAll('[role="alert"], input, select, textarea').forEach(node => node.remove()); return copy.textContent; }).join(' ') || element.name || 'This field';
  return label.replace(/\s+/g, ' ').replace(/\s*\*.*/, '').trim().slice(0, 90);
}
export function fieldSchema(element, values) {
  const label = labelFor(element), key = fieldKey(element), required = element.required, type = element.type;
  let schema = Yup.mixed().nullable().test('required', `${label} is required.`, value => !required || (type === 'checkbox' ? value === true : type === 'file' ? !!value : String(value ?? '').trim().length > 0));
  const test = (name, message, predicate) => { schema = schema.test(name, message, value => value === '' || value == null || predicate(value)); };
  if (type === 'file') {
    test('file-size', 'Choose a file up to 5 MB.', value => value.size > 0 && value.size <= 5 * 1024 * 1024);
    test('file-name', 'Use a file name up to 180 characters.', value => value.name.length <= 180);
    if (values.category === 'pdf') test('pdf', 'Choose a PDF file.', value => /\.pdf$/i.test(value.name));
    return schema;
  }
  if (['checkbox', 'radio'].includes(type)) return schema;
  const maximum = element.maxLength > -1 ? element.maxLength : type === 'search' ? 200 : type === 'url' ? 2048 : type === 'email' ? 254 : null;
  if (maximum !== null) test('max', `Use at most ${maximum} characters.`, value => String(value).length <= maximum);
  if (element.minLength > 0) test('min', `Use at least ${element.minLength} characters.`, value => String(value).length >= element.minLength);
  if (type === 'email') test('email', 'Enter a valid email address.', value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim()));
  if (type === 'tel' || key === 'phone') test('phone', 'Enter a valid phone number with at least 7 digits.', value => /^[+\d() .-]{7,30}$/.test(String(value).trim()) && String(value).replace(/\D/g, '').length >= 7);
  if (type === 'url') test('url', 'Enter a valid HTTP or HTTPS link without credentials.', value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; } });
  if (key === 'password') test('password-bytes', 'Use at most 72 bytes for the password.', value => new TextEncoder().encode(value).length <= 72);
  if (key === 'confirmPassword') schema = schema.test('match', 'Passwords do not match.', value => (value || '') === (values.password || ''));
  if (key === 'researchInterests') test('tags', 'Use up to 10 interests, each at most 50 characters.', value => !validateResearchInterests(researchInterestTags(value)));
  if (type === 'number') {
    test('number', 'Enter a valid number.', value => Number.isFinite(Number(value)));
    if (element.min !== '') test('min-number', `Enter ${element.min} or more.`, value => Number(value) >= Number(element.min));
    if (element.max !== '') test('max-number', `Enter ${element.max} or less.`, value => Number(value) <= Number(element.max));
    if (element.step !== 'any') test('step', element.step === '0.01' ? 'Use at most two decimal places.' : 'Enter a whole number.', value => { const step = Number(element.step || 1), number = (Number(value) - Number(element.min || 0)) / step; return Math.abs(number - Math.round(number)) < 0.000001; });
  }
  if (element.tagName === 'SELECT') test('choice', 'Choose an available option.', value => [...element.options].some(option => option.value === value && !option.disabled));
  if (['date', 'time', 'datetime-local'].includes(type)) test('date', 'Enter a valid date or time.', value => type === 'time' ? /^\d{2}:\d{2}(?::\d{2})?$/.test(value) : Number.isFinite(Date.parse(type === 'datetime-local' ? `${value}+06:00` : value)));
  if (element.dataset.future === 'true') test('future', 'Choose a future date and time.', value => Date.parse(`${value}+06:00`) > Date.now());
  if (element.validity?.customError) schema = schema.test('custom', element.validationMessage, () => false);
  return schema;
}
export function validateFields(elements, values) {
  const errors = {};
  for (const element of elements) {
    const key = fieldKey(element);
    try { fieldSchema(element, values).validateSync(values[key]); }
    catch (error) { errors[key] = error.message; }
  }
  const has = key => elements.some(element => fieldKey(element) === key);
  if (has('status') && has('deadline') && values.status === 'open') {
    if (!values.deadline || Date.parse(`${values.deadline}+06:00`) <= Date.now()) errors.deadline = 'Choose a future deadline before opening this period.';
    if (!String(values.notice || '').trim()) errors.notice = 'Enter a notice before opening this period.';
  }
  if (has('date') && has('time') && values.date && values.time && Date.parse(`${values.date}T${values.time}+06:00`) <= Date.now()) errors.date = 'Choose a future defence date and time.';
  if (has('meetingLink') && has('venue') && !String(values.venue || '').trim() && !String(values.meetingLink || '').trim()) errors.venue = 'Enter a venue or a meeting link.';
  const choices = Object.keys(values).filter(key => /^supervisorChoice\d$/.test(key));
  for (const key of choices) if (values[key] && choices.some(other => other !== key && values[other] === values[key])) errors[key] = 'Choose three different supervisors.';
  return errors;
}
