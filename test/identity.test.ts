import { describe, expect, it } from 'vitest';
import { harness, register } from './helpers.js';
import { MemoryStore } from './memory-store.js';

describe('Identity use cases', () => {
  it('creates a verified user only after the code, normalizes email and hides secrets', async () => {
    const h = harness(); const store = h.store as MemoryStore;
    const challenge = await h.service.requestCode('  USER@example.com  ', 'REGISTRATION', h.requestId);
    expect(store.users.size).toBe(0);
    expect(store.challenges.get(challenge.challengeId)!.codeHash).not.toBe(h.mail.lastCode());
    const input = { challengeId: challenge.challengeId, code: h.mail.lastCode(), displayName: '  Test User  ', password: 'VerySecurePassword123!' };
    const user = await h.service.register(input, h.requestId);
    expect(user.email).toBe('user@example.com'); expect(user.displayName).toBe('Test User');
    expect(user).not.toHaveProperty('passwordHash');
    expect(store.users.get(user.id)!.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(h.service.register(input, h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_EMAIL_CODE' });
  });
  it('commits failed code attempts and locks the challenge after five errors', async () => {
    const h = harness(); const store = h.store as MemoryStore;
    const c = await h.service.requestCode('user@example.com', 'REGISTRATION', h.requestId);
    const real = h.mail.lastCode(); const wrong = real === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await expect(h.service.register({ challengeId: c.challengeId, code: wrong, displayName: 'Test User', password: 'VerySecurePassword123!' }, h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_EMAIL_CODE' });
    expect(store.challenges.get(c.challengeId)!.attempts).toBe(5);
    await expect(h.service.register({ challengeId: c.challengeId, code: real, displayName: 'Test User', password: 'VerySecurePassword123!' }, h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_EMAIL_CODE' });
  });
  it('expires codes and never accepts a registration code for password reset', async () => {
    const h = harness(); const c = await h.service.requestCode('user@example.com', 'REGISTRATION', h.requestId);
    await expect(h.service.resetPassword({ challengeId: c.challengeId, code: h.mail.lastCode(), newPassword: 'OtherSecurePassword123!' }, h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_EMAIL_CODE' });
    h.advance(601000);
    await expect(h.service.register({ challengeId: c.challengeId, code: h.mail.lastCode(), displayName: 'Test User', password: 'VerySecurePassword123!' }, h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_EMAIL_CODE' });
  });
  it('enforces resend cooldown and invalidates the previous code', async () => {
    const h = harness(); const c = await h.service.requestCode('user@example.com', 'REGISTRATION', h.requestId); const old = h.mail.lastCode();
    await expect(h.service.requestCode('user@example.com', 'REGISTRATION', h.requestId)).rejects.toMatchObject({ status: 429, retryAfter: 60 });
    h.advance(61000); await h.service.requestCode('user@example.com', 'REGISTRATION', h.requestId);
    await expect(h.service.register({ challengeId: c.challengeId, code: old, displayName: 'Test User', password: 'VerySecurePassword123!' }, h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_EMAIL_CODE' });
  });
  it('returns generic credentials errors for missing, wrong password and suspended users', async () => {
    const h = harness(); const user = await register(h);
    for (const [email, password] of [['missing@example.com', 'VerySecurePassword123!'], ['user@example.com', 'wrong']]) await expect(h.service.login(email, password, h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' });
    (h.store as MemoryStore).users.get(user.id)!.status = 'SUSPENDED';
    await expect(h.service.login(user.email, 'VerySecurePassword123!', h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
  });
  it('rotates refresh tokens and commits family revocation on replay', async () => {
    const h = harness(); await register(h);
    const first = await h.service.login('user@example.com', 'VerySecurePassword123!', h.requestId);
    const second = await h.service.refresh(first.refreshToken, h.requestId);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(h.service.refresh(first.refreshToken, h.requestId)).rejects.toMatchObject({ code: 'AUTH_REFRESH_TOKEN_REUSED' });
    await expect(h.service.authenticate(second.accessToken)).rejects.toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
    await expect(h.service.refresh(second.refreshToken, h.requestId)).rejects.toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
    expect((h.store as MemoryStore).events.some((e) => e.action === 'identity.refresh_reuse_detected')).toBe(true);
  });
  it('serializes concurrent refresh and invalidates the winning token after replay', async () => {
    const h = harness(); await register(h); const pair = await h.service.login('user@example.com', 'VerySecurePassword123!', h.requestId);
    const results = await Promise.allSettled([h.service.refresh(pair.refreshToken, h.requestId), h.service.refresh(pair.refreshToken, h.requestId)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const winner = results.find((r) => r.status === 'fulfilled')!;
    if (winner.status === 'fulfilled') await expect(h.service.authenticate(winner.value.accessToken)).rejects.toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
  });
  it('logout current does not revoke another session; logout-all revokes all', async () => {
    const h = harness(); await register(h);
    const first = await h.service.login('user@example.com', 'VerySecurePassword123!', h.requestId);
    const other = await h.service.login('user@example.com', 'VerySecurePassword123!', h.requestId);
    await h.service.logout(await h.service.authenticate(first.accessToken), false, h.requestId);
    await expect(h.service.authenticate(first.accessToken)).rejects.toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
    const identity = await h.service.authenticate(other.accessToken);
    const third = await h.service.login('user@example.com', 'VerySecurePassword123!', h.requestId);
    await h.service.logout(identity, true, h.requestId);
    await expect(h.service.authenticate(third.accessToken)).rejects.toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
  });
  it('password reset is single-use, changes the hash and revokes every session', async () => {
    const h = harness(); await register(h); const pair = await h.service.login('user@example.com', 'VerySecurePassword123!', h.requestId);
    h.advance(1000); const c = await h.service.requestCode('user@example.com', 'PASSWORD_RESET', h.requestId);
    const input = { challengeId: c.challengeId, code: h.mail.lastCode(), newPassword: 'OtherSecurePassword123!' };
    await h.service.resetPassword(input, h.requestId);
    await expect(h.service.authenticate(pair.accessToken)).rejects.toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
    await expect(h.service.login('user@example.com', 'VerySecurePassword123!', h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    await expect(h.service.login('user@example.com', input.newPassword, h.requestId)).resolves.toHaveProperty('accessToken');
    await expect(h.service.resetPassword(input, h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_EMAIL_CODE' });
  });
  it('does not create an existing user or reset a nonexistent account', async () => {
    const h = harness(); await register(h); h.advance(61000);
    const c = await h.service.requestCode('user@example.com', 'REGISTRATION', h.requestId);
    await expect(h.service.register({ challengeId: c.challengeId, code: h.mail.lastCode(), displayName: 'Other User', password: 'VerySecurePassword123!' }, h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_EMAIL_CODE' });
    const reset = await h.service.requestCode('missing@example.com', 'PASSWORD_RESET', h.requestId);
    await expect(h.service.resetPassword({ challengeId: reset.challengeId, code: h.mail.lastCode(), newPassword: 'VerySecurePassword123!' }, h.requestId)).rejects.toMatchObject({ code: 'AUTH_INVALID_EMAIL_CODE' });
  });
  it('revokes a challenge when email delivery fails without exposing provider details', async () => {
    const h = harness(); h.mail.fail = true;
    await expect(h.service.requestCode('user@example.com', 'REGISTRATION', h.requestId)).rejects.toMatchObject({ status: 503, code: 'EMAIL_DELIVERY_UNAVAILABLE' });
    const challenge = [...(h.store as MemoryStore).challenges.values()][0]; expect(challenge.revokedAt).not.toBeNull();
  });
  it('expires idle refresh and the absolute session', async () => {
    const h = harness(); await register(h); const pair = await h.service.login('user@example.com', 'VerySecurePassword123!', h.requestId);
    h.advance(86401000); await expect(h.service.refresh(pair.refreshToken, h.requestId)).rejects.toMatchObject({ code: 'AUTH_REFRESH_TOKEN_EXPIRED' });
    h.advance(604800000); await expect(h.service.authenticate(pair.accessToken)).rejects.toMatchObject({ code: 'AUTH_SESSION_EXPIRED' });
  });
});
