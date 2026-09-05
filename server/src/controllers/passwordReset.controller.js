const passwordResetService = require('../services/passwordReset.service');

const NEUTRAL_RESPONSE =
  'If an account exists for that email, a reset link has been sent to it.';

async function requestReset(req, res) {
  const { email } = req.body ?? {};
  await passwordResetService.requestPasswordReset({ email });

  res.status(200).json({ data: null, message: NEUTRAL_RESPONSE });
}

async function checkToken(req, res) {
  const valid = await passwordResetService.isResetTokenValid(req.query.token);
  res.status(200).json({ data: { valid }, message: 'Token checked' });
}

async function resetPassword(req, res) {
  const { token, password } = req.body ?? {};
  await passwordResetService.resetPassword({ token, password });

  res.status(200).json({ data: null, message: 'Password updated. You can now sign in.' });
}

module.exports = { requestReset, checkToken, resetPassword };
