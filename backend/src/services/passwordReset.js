import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { hashToken } from './tokens.js';
import { mailConfigured, sendResetEmail } from './mail.js';

export function passwordReset(pool, config, send = sendResetEmail) {
  return {
    async request(email) {
      if (!mailConfigured(config))
        throw Object.assign(new Error('Відновлення пароля тимчасово недоступне.'), { status: 503 });
      const { rows } = await pool.query('SELECT id FROM users WHERE lower(email)=$1', [email]);
      if (!rows[0]) return;
      const token = randomBytes(32).toString('hex');
      await pool.query('INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,$3)', [hashToken(token), rows[0].id, new Date(Date.now() + 30 * 60000)]);
      const url = new URL('/reset-password', config.storeUrl);
      url.hash = token;
      try {
        await send(email, url.href, config);
      } catch {
        await pool.query('DELETE FROM password_reset_tokens WHERE token_hash=$1', [hashToken(token)]);
        throw Object.assign(new Error('Не вдалося надіслати лист. Спробуйте пізніше.'), { status: 503 });
      }
    },
    async reset(token, password) {
      const digest = await bcrypt.hash(password, 12);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT u.id FROM users u JOIN password_reset_tokens t ON t.user_id=u.id WHERE t.token_hash=$1 FOR UPDATE OF u', [hashToken(token)]);
        const result = await client.query('UPDATE password_reset_tokens SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING user_id', [hashToken(token)]);
        if (!rows[0] || !result.rows[0]) throw Object.assign(new Error('Посилання недійсне або прострочене. Замовте новий лист.'), { status: 400 });
        await client.query('UPDATE users SET password=$1,password_changed_at=now() WHERE id=$2', [digest, rows[0].id]);
        await client.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL', [rows[0].id]);
        await client.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [rows[0].id]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

