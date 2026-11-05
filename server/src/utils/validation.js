const AppError = require('./AppError');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;

function requireText(value, label, { max = 255 } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw AppError.badRequest(`${label} is required`);
  if (text.length > max) throw AppError.badRequest(`${label} must be ${max} characters or fewer`);
  return text;
}

function requireEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email) throw AppError.badRequest('Email is required');
  if (email.length > 255 || !EMAIL_PATTERN.test(email)) {
    throw AppError.badRequest('Enter a valid email address');
  }
  return email;
}

function requirePassword(value) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw AppError.badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw AppError.badRequest(`Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`);
  }
  return password;
}

function optionalText(value, label, { max = 255 } = {}) {
  if (value === undefined || value === null || isBlankString(value)) return null;
  return requireText(value, label, { max });
}

function isBlankString(value) {
  return typeof value === 'string' && value.trim() === '';
}

function requireNumber(value, label, { min, max } = {}) {
  const number = Number(value);
  const isNumberOrText = typeof value === 'number' || (typeof value === 'string' && !isBlankString(value));
  if (!isNumberOrText || !Number.isFinite(number)) {
    throw AppError.badRequest(`${label} must be a number`);
  }
  if (min !== undefined && number < min) {
    throw AppError.badRequest(`${label} must be ${min} or greater`);
  }
  if (max !== undefined && number > max) {
    throw AppError.badRequest(`${label} must be ${max} or less`);
  }
  return number;
}

function optionalNumber(value, label, options = {}) {
  if (value === undefined || value === null || isBlankString(value)) return null;
  return requireNumber(value, label, options);
}

const PHONE_ALLOWED_CHARACTERS = /^\+?[0-9\s\-()]+$/;
const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

function optionalPhone(value, label = 'Phone') {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw AppError.badRequest(`${label} must be text`);
  const phone = value.trim();
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (
    !PHONE_ALLOWED_CHARACTERS.test(phone) ||
    digits.length < MIN_PHONE_DIGITS ||
    digits.length > MAX_PHONE_DIGITS
  ) {
    throw AppError.badRequest(
      `${label} must be a valid number with ${MIN_PHONE_DIGITS}–${MAX_PHONE_DIGITS} digits (digits, spaces, + - ( ) only)`
    );
  }
  return phone;
}

// new Date('2026-02-30') quietly rolls over to 2 March, so the date must also survive the round trip.
function isValidDateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// ISO only (date, or date and time). new Date() alone would also read "5" as a date in 2001.
function isValidDateTime(value) {
  if (typeof value !== 'string' || !DATE_TIME_PATTERN.test(value)) return false;
  return isValidDateOnly(value.slice(0, 10)) && !Number.isNaN(new Date(value).getTime());
}

function requireDateOnly(value, label) {
  if (!isValidDateOnly(value)) {
    throw AppError.badRequest(`${label} must be a valid date (YYYY-MM-DD)`);
  }
  return value;
}

function requireIdFilter(value, label) {
  const id = requireNumber(value, label, { min: 1 });
  if (!Number.isInteger(id)) throw AppError.badRequest(`${label} must be a number`);
  return id;
}

function optionalEmail(value) {
  if (value === undefined || value === null || value === '') return null;
  return requireEmail(value);
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  requireText,
  requireEmail,
  requirePassword,
  optionalText,
  requireNumber,
  optionalNumber,
  optionalEmail,
  optionalPhone,
  isValidDateOnly,
  isValidDateTime,
  requireDateOnly,
  requireIdFilter,
};
