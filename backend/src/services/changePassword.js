import bcrypt from 'bcrypt';

export async function changePassword(pool, userId, data) {
  const digest = await bcrypt.hash(data.password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT password FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!rows[0] || !await bcrypt.compare(data.currentPassword, rows[0].password))
      throw Object.assign(new Error('Поточний пароль неправильний.'), {status:400});
    await client.query('UPDATE users SET password=$1,password_changed_at=clock_timestamp() WHERE id=$2', [digest,userId]);
    await client.query('UPDATE password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL', [userId]);
    await client.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
