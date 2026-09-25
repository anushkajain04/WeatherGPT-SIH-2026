import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import ragService from '../src/services/rag.service.js';
import nmtService from '../src/services/bhashini/nmt.service.js';

let server;
let baseUrl;

before(async () => {
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
  await new Promise((resolve) => server.close(resolve));
});

describe('Express Gateway & Security Integration Tests', () => {
  test('GET /api/health returns 200 and includes X-Request-ID header', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);

    const requestId = res.headers.get('x-request-id');
    assert.ok(requestId, 'Response must include X-Request-ID header');

    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
    assert.ok(typeof body.uptimeSeconds === 'number');
    assert.ok(body.upstream);
  });

  test('GET /api/status returns subsystem status overview', async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    assert.ok([200, 207].includes(res.status));

    const body = await res.json();
    assert.ok(body.subsystems);
    assert.ok(body.subsystems.rag);
    assert.ok(body.subsystems.bhashiniConfig);
    assert.ok(body.subsystems.bhashiniNmt);
  });

  test('POST /api/chat rejects payload larger than 10KB with 413', async () => {
    const hugeQuery = 'a'.repeat(12 * 1024); // 12KB
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: hugeQuery }),
    });

    assert.strictEqual(res.status, 413);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'PAYLOAD_TOO_LARGE');
  });

  test('POST /api/chat rejects invalid input with 422 and field-level validation errors', async () => {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '', // Invalid empty query
        location: 'Invalid@Location#123', // Invalid chars
        role: 'invalid_role', // Invalid role
      }),
    });

    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(body.error.details));
    const fields = body.error.details.map((d) => d.field);
    assert.ok(fields.includes('query'));
    assert.ok(fields.includes('location'));
    assert.ok(fields.includes('role'));
  });

  test('GET /api/nonexistent returns 404 with standardized error structure', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent`);
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'NOT_FOUND');
    assert.ok(body.reqId);
  });

  test('POST /api/chat completes end-to-end flow and records stage timings', async () => {
    // Stub RAG service query
    const originalQueryRAG = ragService.queryRAG;
    ragService.queryRAG = async ({ query, role, location }) => {
      return {
        answer: 'Expect partly cloudy skies with a temperature of 28°C.',
        route: 'rag_weather',
        model_used: 'gemini-1.5-flash',
        latency_seconds: 0.45,
        location_resolved: { city: 'Mumbai', lat: 19.07, lon: 72.87 },
      };
    };

    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'What is the weather today?',
          location: 'Mumbai',
          role: 'commuter',
          language: 'en',
          sessionId: 'integration-test-session',
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.strictEqual(body.answer, 'Expect partly cloudy skies with a temperature of 28°C.');
      assert.strictEqual(body.answerEnglish, 'Expect partly cloudy skies with a temperature of 28°C.');
      assert.strictEqual(body.detectedLanguage, 'en');
      assert.strictEqual(body.languageConfidence, 'explicit');
      assert.strictEqual(body.translationFailed, false);
      assert.strictEqual(body.route, 'rag_weather');
      assert.ok(body.timings);
      assert.ok(typeof body.timings.total === 'number');
      assert.ok(typeof body.timings.rag === 'number');
    } finally {
      ragService.queryRAG = originalQueryRAG;
    }
  });

  test('POST /api/chat degrades gracefully to English when output translation fails', async () => {
    // Stub RAG service query
    const originalQueryRAG = ragService.queryRAG;
    const originalTranslate = nmtService.translate;

    ragService.queryRAG = async () => ({
      answer: 'Heavy thunderstorms expected.',
      route: 'rag_alert',
      model_used: 'gemini-1.5-flash',
      latency_seconds: 0.3,
      location_resolved: { city: 'Delhi' },
    });

    // Mock NMT output translation failure
    nmtService.translate = async (text, src, tgt) => {
      if (src === 'en' && tgt === 'hi') {
        throw new Error('Upstream NMT pipeline quota exceeded');
      }
      return text;
    };

    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'aaj mausam kaisa hai', // Hinglish detected as hi
          location: 'Delhi',
          sessionId: 'graceful-degrade-session',
        }),
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();

      assert.strictEqual(body.detectedLanguage, 'hi');
      assert.strictEqual(body.translationFailed, true);
      assert.strictEqual(body.answer, 'Heavy thunderstorms expected.');
      assert.strictEqual(body.answerEnglish, 'Heavy thunderstorms expected.');
    } finally {
      ragService.queryRAG = originalQueryRAG;
      nmtService.translate = originalTranslate;
    }
  });

  test('POST /api/tts returns 422 if required parameters are missing', async () => {
    const res = await fetch(`${baseUrl}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '' }),
    });

    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });
});
