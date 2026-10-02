import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import User from '../src/models/user.model.js';
import Otp from '../src/models/otp.model.js';

let server;
let baseUrl;

const TEST_EMAIL = `test_${Date.now()}@example.com`;
const TEST_PHONE = '9876543210'; // Valid Indian mobile number

before(async () => {
  await connectDB();
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  // Clean up test data
  await User.deleteMany({ email: TEST_EMAIL });
  await Otp.deleteMany({ contact: TEST_EMAIL });
  await Otp.deleteMany({ contact: `+91${TEST_PHONE}` });

  await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
});

describe('Authentication Flow Integration Tests', () => {
  let sessionCookie = '';
  let capturedOtp = null;

  // Intercept console.log to capture generated OTP in dev console mode
  const originalLog = console.log;

  before(() => {
    console.log = (...args) => {
      const msg = args.join(' ');
      const match = msg.match(/OTP for .*?:\s*(\d{6})/);
      if (match) {
        capturedOtp = match[1];
      }
      originalLog(...args);
    };
  });

  after(() => {
    console.log = originalLog;
  });

  test('1. POST /api/auth/otp/request fails without CSRF header', async () => {
    const res = await fetch(`${baseUrl}/api/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact: TEST_EMAIL }),
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });

  test('2. POST /api/auth/otp/request succeeds with CSRF header and logs OTP', async () => {
    capturedOtp = null;
    const res = await fetch(`${baseUrl}/api/auth/otp/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'WeatherGPT',
      },
      body: JSON.stringify({ contact: TEST_EMAIL }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(capturedOtp, 'OTP must be captured from console');
    assert.match(capturedOtp, /^\d{6}$/);
  });

  test('3. POST /api/auth/otp/verify rejects wrong OTP code', async () => {
    const res = await fetch(`${baseUrl}/api/auth/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'WeatherGPT',
      },
      body: JSON.stringify({
        contact: TEST_EMAIL,
        code: '000000',
      }),
    });

    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  test('4. POST /api/auth/otp/verify succeeds with correct code and sets wgpt_session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'WeatherGPT',
      },
      body: JSON.stringify({
        contact: TEST_EMAIL,
        code: capturedOtp,
        profile: {
          role: 'farmer',
          location: 'Pune',
          preferredLanguage: 'hi',
        },
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.email, TEST_EMAIL);
    assert.strictEqual(body.user.role, 'farmer');
    assert.strictEqual(body.user.location, 'Pune');
    assert.strictEqual(body.user.preferredLanguage, 'hi');

    // Extract cookie from Set-Cookie header
    const rawCookie = res.headers.get('set-cookie');
    assert.ok(rawCookie, 'Set-Cookie header must be present');
    assert.ok(rawCookie.includes('wgpt_session='), 'Cookie name must be wgpt_session');
    sessionCookie = rawCookie.split(';')[0];
  });

  test('5. GET /api/auth/me returns 401 Unauthorized without session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.strictEqual(res.status, 401);
  });

  test('6. GET /api/auth/me returns authenticated user with valid session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Cookie: sessionCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.email, TEST_EMAIL);
    assert.strictEqual(body.user.role, 'farmer');
  });

  test('7. PATCH /api/auth/me updates user profile', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'WeatherGPT',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        role: 'tourist',
        location: 'Goa',
        preferredLanguage: 'en',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.role, 'tourist');
    assert.strictEqual(body.user.location, 'Goa');
    assert.strictEqual(body.user.preferredLanguage, 'en');
  });

  test('8. POST /api/auth/link/request and /link/verify links secondary phone number', async () => {
    capturedOtp = null;
    const reqRes = await fetch(`${baseUrl}/api/auth/link/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'WeatherGPT',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ contact: TEST_PHONE }),
    });

    assert.strictEqual(reqRes.status, 200);
    assert.ok(capturedOtp, 'SMS OTP must be logged in console');

    const verifyRes = await fetch(`${baseUrl}/api/auth/link/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'WeatherGPT',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        contact: TEST_PHONE,
        code: capturedOtp,
      }),
    });

    assert.strictEqual(verifyRes.status, 200);
    const body = await verifyRes.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.user.phone, `+91${TEST_PHONE}`);
    assert.strictEqual(body.user.email, TEST_EMAIL);
  });

  test('9. POST /api/auth/logout clears session cookie', async () => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'WeatherGPT',
        Cookie: sessionCookie,
      },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Set-Cookie header must be sent on logout');
    // Cookie is cleared with max-age=0 or expires in past
    assert.ok(setCookie.includes('wgpt_session=;') || setCookie.includes('Expires=Thu, 01 Jan 1970'));
  });
});
