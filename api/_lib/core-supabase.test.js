const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('./core-supabase');

test('buildTenantContext deniega por defecto cuando falta identidad o organization', async () => {
  const result = await core.buildTenantContext({ headers: {} }, 'site:read', {});
  assert.equal(result.authorization.allowed, false);
  assert.equal(result.authorization.contractVersion, '0.1.0');
  assert.equal(result.authorization.context, null);
});

test('resolveIdentity no inventa identidad sin Bearer token', async () => {
  assert.equal(await core.resolveIdentity({ headers: {} }, {}), null);
});

test('resolveIdentity usa la identidad autenticada del proveedor', async () => {
  const client = { auth: { getUser: async (token) => ({ data: { user: { id: 'user-1', token } } }) } };
  assert.deepEqual(await core.resolveIdentity({ headers: { authorization: 'Bearer jwt' } }, client), { userId: 'user-1', externalSubject: 'user-1' });
});

test('la composición exige schema core en el cliente anfitrión', async () => {
  await assert.rejects(() => core.authorize({ userId: 'u', organizationId: 'o' }, 'x', {}), /schema/);
});
