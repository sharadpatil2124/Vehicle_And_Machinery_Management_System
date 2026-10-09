const AppError = require('./AppError');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
  if (value === undefined || value === null || value === '') return null;
  return requireText(value, label, { max });
}

function requireNumber(value, label, { min } = {}) {
  const number = Number(value);
  if (typeof value === 'boolean' || value === '' || value === null || !Number.isFinite(number)) {
    throw AppError.badRequest(`${label} must be a number`);
  }
  if (min !== undefined && number < min) {
    throw AppError.badRequest(`${label} must be ${min} or greater`);
  }
  return number;
}

function optionalNumber(value, label, options = {}) {
  if (value === undefined || value === null || value === '') return null;
  return requireNumber(value, label, options);
}

const PHONE_ALLOWED_CHARACTERS = /^\+?[0-9\s\-()]+$/;
const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

function optionalPhone(value, label = 'Phone') {
  if (value === undefined || value === null || value === '') return null;
  const phone = typeof value === 'string' ? value.trim() : '';
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
};
