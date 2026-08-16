import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../src/app.js';

test('health endpoint returns service status', async () => {
  const app = buildApp();
  const response = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok', service: 'virtual-mandi-api' });
  await app.close();
});

test('invalid auth input returns consistent validation envelope', async () => {
  const app = buildApp();
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email: 'not-an-email', password: 'short' },
  });
  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.equal(typeof body.error.requestId, 'string');
  assert.ok(Array.isArray(body.error.fields));
  await app.close();
});

test('protected routes reject missing bearer token', async () => {
  const app = buildApp();
  const response = await app.inject({ method: 'GET', url: '/v1/me' });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'UNAUTHORIZED');
  await app.close();
});
