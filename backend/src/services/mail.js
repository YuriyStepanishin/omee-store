import nodemailer from 'nodemailer';

export function mailConfigured(config) {
  return Boolean(config.mailFrom && config.storeUrl && (config.smtpHost
    ? config.smtpUser && config.smtpPassword
    : config.mailKey));
}

export function smtpOptions(config) {
  return {
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    requireTLS: config.smtpPort !== 465,
    auth: { user: config.smtpUser, pass: config.smtpPassword },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

export async function sendResetEmail(email, url, config) {
  const message = {
    from: config.mailFrom,
    to: email,
    subject: 'Відновлення пароля omee store',
    text: `Для зміни пароля відкрийте посилання протягом 30 хвилин:\n${url}\nЯкщо ви не замовляли зміну пароля, проігноруйте цей лист.`,
  };
  if (config.smtpHost) {
    const transport = nodemailer.createTransport(smtpOptions(config));
    const result = await transport.sendMail(message);
    if (!result.accepted?.length) throw new Error('Mail delivery failed');
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${config.mailKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...message, to: [email] }),
  });
  if (!response.ok) throw new Error('Mail delivery failed');
}
