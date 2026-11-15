import jwt from 'jsonwebtoken';
import { createHash, randomUUID } from 'node:crypto';
export const hashToken = token =>
  createHash('sha256').update(token).digest('hex');
const options = {
  algorithm: 'HS256',
  issuer: 'omee',
  audience: 'kateryna-store',
};
export function signSession(user, config) {
  const id = randomUUID();
  return {
    id,
    access: jwt.sign({ type: 'access', issuedAt: Date.now() }, config.accessSecret, {
      ...options,
      subject: user.id,
      expiresIn: '15m',
    }),
    refresh: jwt.sign({ type: 'refresh' }, config.refreshSecret, {
      ...options,
      subject: user.id,
      jwtid: id,
      expiresIn: '7d',
    }),
    expiresAt: new Date(Date.now() + 7 * 86400000),
  };
}
export function verifyToken(token, type, config) {
  try {
    const payload = jwt.verify(
      token,
      type === 'access' ? config.accessSecret : config.refreshSecret,
      {
        algorithms: ['HS256'],
        issuer: options.issuer,
        audience: options.audience,
      }
    );
    if (
      typeof payload !== 'object' ||
      payload.type !== type ||
      typeof payload.sub !== 'string' ||
      (type === 'refresh' && typeof payload.jti !== 'string')
    )
      throw Error();
    return payload;
  } catch {
    throw Object.assign(new Error('Сесія завершилася. Увійдіть знову.'), {
      status: 401,
    });
  }
}
export function cookies(req) {
  const values = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    try {
      values[part.slice(0, index).trim()] = decodeURIComponent(
        part.slice(index + 1)
      );
    } catch {}
  }
  return values;
}
export function writeSession(res, session, production) {
  const secure = production ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    `kss_access=${encodeURIComponent(session.access)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=900${secure}`,
    `kss_refresh=${encodeURIComponent(session.refresh)}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`,
  ]);
}
export function clearSession(res, production) {
  const secure = production ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    `kss_access=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    `kss_refresh=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  ]);
}
