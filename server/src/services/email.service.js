const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.email.smtp.host,
    port: env.email.smtp.port,
    secure: env.email.smtp.secure,
    auth: env.email.smtp.user
      ? { user: env.email.smtp.user, pass: env.email.smtp.password }
      : undefined,
  });

  return transporter;
}

function logEmailToConsole({ to, subject, text }) {
  const rule = '='.repeat(70);
  process.stdout.write(
    `\n${rule}\nEMAIL (console transport — not sent)\nTo: ${to}\nSubject: ${subject}\n${rule}\n${text}\n${rule}\n\n`
  );
}

async function sendEmail({ to, subject, text }) {
  if (env.email.transport === 'console') {
    logEmailToConsole({ to, subject, text });
    return;
  }

  try {
    await getTransporter().sendMail({ from: env.email.from, to, subject, text });
  } catch (error) {
    logger.error('Email delivery failed', { to, subject, reason: error.message });
  }
}

function sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes }) {
  return sendEmail({
    to,
    subject: 'Reset your VMMS password',
    text: [
      `Hello ${name},`,
      '',
      'Use the link below to choose a new password:',
      resetUrl,
      '',
      `This link expires in ${expiresInMinutes} minutes and can be used once.`,
      'If you did not request it, no action is needed and your password is unchanged.',
    ].join('\n'),
  });
}

function sendSupervisorInviteEmail({ to, name, organizationName, resetUrl, expiresInMinutes }) {
  return sendEmail({
    to,
    subject: `You have been added to ${organizationName} on VMMS`,
    text: [
      `Hello ${name},`,
      '',
      `You have been added to ${organizationName} as a Supervisor.`,
      'Use the link below to set your password and sign in:',
      resetUrl,
      '',
      `This link expires in ${expiresInMinutes} minutes and can be used once.`,
    ].join('\n'),
  });
}

module.exports = { sendPasswordResetEmail, sendSupervisorInviteEmail };
