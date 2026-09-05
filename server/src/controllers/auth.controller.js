const authService = require('../services/auth.service');

async function signUp(req, res) {
  const { organizationName, name, email, password } = req.body ?? {};
  const data = await authService.signUp({ organizationName, name, email, password });

  res.status(201).json({ data, message: 'Organization created' });
}

async function logIn(req, res) {
  const { email, password } = req.body ?? {};
  const data = await authService.logIn({ email, password });

  res.status(200).json({ data, message: 'Signed in' });
}

async function logOut(req, res) {
  await authService.logOut({ userId: req.auth.userId, tenantId: req.auth.tenantId });

  res.status(200).json({ data: null, message: 'Signed out' });
}

async function me(req, res) {
  const { userId, email, name, role, tenantId, organizationName } = req.auth;

  res.status(200).json({
    data: {
      user: { id: userId, name, email, role },
      organization: { tenantId, organizationName },
    },
    message: 'Profile retrieved',
  });
}

module.exports = { signUp, logIn, logOut, me };
