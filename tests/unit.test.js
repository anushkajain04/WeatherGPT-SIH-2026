import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { detectRomanizedHindi } from '../src/config/romanized-keywords.js';
import { SUPPORTED_LANGUAGE_CODES } from '../src/config/constants.js';
import { CacheService } from '../src/services/cache.service.js';
import { SessionService } from '../src/services/session.service.js';
import {
  AppError,
  ValidationError,
  RAGServiceError,
  UnsupportedLanguageError,
  NMTError,
} from '../src/utils/errors.js';
import { LanguageResolverService } from '../src/services/language-resolver.service.js';
import { chatBodySchema, voiceChatBodySchema } from '../src/validators/chat.validator.js';
import { ttsBodySchema } from '../src/validators/tts.validator.js';

describe('1. Romanized Hindi Detection Heuristic', () => {
  test('correctly identifies Hinglish weather queries', () => {
    const res1 = detectRomanizedHindi('aaj mausam kaisa hai');
    assert.strictEqual(res1.isMatch, true);
    assert.ok(res1.matchedKeywords.includes('mausam'));
    assert.ok(res1.matchedKeywords.includes('hai'));

    const res2 = detectRomanizedHindi('kya kal baarish hogi?');
    assert.strictEqual(res2.isMatch, true);
    assert.ok(res2.matchedKeywords.includes('baarish'));
    assert.ok(res2.matchedKeywords.includes('hogi'));
  });

  test('does not match standard English weather queries', () => {
    const res = detectRomanizedHindi('What is the weather in Delhi tomorrow?');
    assert.strictEqual(res.isMatch, false);
    assert.strictEqual(res.matchedKeywords.length, 0);
  });
});

describe('2. In-Memory Cache Service', async () => {
  test('stores, retrieves, and respects TTL expiration', async () => {
    const cache = new CacheService({ pruneIntervalMs: 10000 });
    cache.set('test-key', { foo: 'bar' }, 50); // 50ms TTL

    assert.deepStrictEqual(cache.get('test-key'), { foo: 'bar' });
    assert.strictEqual(cache.has('test-key'), true);

    // Wait for expiration
    await new Promise((r) => setTimeout(r, 70));

    assert.strictEqual(cache.get('test-key'), null);
    assert.strictEqual(cache.has('test-key'), false);

    cache.destroy();
  });
});

describe('3. Session Service & Follow-Up Rewriter', () => {
  test('persists session turns and keeps at most 3 turns', () => {
    const session = new SessionService();
    const sessionId = 'test-session-1';

    session.saveTurn(sessionId, { query: 'q1', answer: 'a1', location: 'Delhi', language: 'en' });
    session.saveTurn(sessionId, { query: 'q2', answer: 'a2', location: 'Delhi', language: 'en' });
    session.saveTurn(sessionId, { query: 'q3', answer: 'a3', location: 'Delhi', language: 'en' });
    session.saveTurn(sessionId, { query: 'q4', answer: 'a4', location: 'Delhi', language: 'en' });

    const sess = session.getSession(sessionId);
    assert.strictEqual(sess.turns.length, 3);
    assert.strictEqual(sess.turns[0].query, 'q2');
    assert.strictEqual(sess.turns[2].query, 'q4');
    assert.strictEqual(sess.lastLocation, 'Delhi');
  });

  test('rewrites short follow-up query using last location from session', () => {
    const session = new SessionService();
    const sessionId = 'test-session-2';

    session.saveTurn(sessionId, { query: 'Weather in Mumbai', answer: 'Sunny', location: 'Mumbai', language: 'en' });

    const rewritten = session.rewriteFollowUp(sessionId, 'What about tomorrow?');
    assert.strictEqual(rewritten.isRewritten, true);
    assert.strictEqual(rewritten.effectiveLocation, 'Mumbai');
    assert.strictEqual(rewritten.rewrittenQuery, 'What about tomorrow in Mumbai?');
  });

  test('preserves standalone query if location is already in query', () => {
    const session = new SessionService();
    const sessionId = 'test-session-3';

    session.saveTurn(sessionId, { query: 'Weather in Mumbai', answer: 'Sunny', location: 'Mumbai', language: 'en' });

    const result = session.rewriteFollowUp(sessionId, 'What is the weather in Pune tomorrow?', 'Pune');
    assert.strictEqual(result.isRewritten, false);
    assert.strictEqual(result.effectiveLocation, 'Pune');
    assert.strictEqual(result.rewrittenQuery, 'What is the weather in Pune tomorrow?');
  });
});

describe('4. Language Resolver Service', async () => {
  const resolver = new LanguageResolverService();

  test('explicit language in request always wins', async () => {
    const res = await resolver.resolveLanguage('aaj mausam kaisa hai', 'bn');
    assert.strictEqual(res.language, 'bn');
    assert.strictEqual(res.confidence, 'explicit');
  });

  test('unsupported language throws UnsupportedLanguageError', async () => {
    await assert.rejects(
      async () => resolver.resolveLanguage('hello', 'bho'),
      (err) => err instanceof UnsupportedLanguageError && err.statusCode === 422
    );
  });

  test('romanized Hindi without explicit flag resolves via heuristic', async () => {
    const res = await resolver.resolveLanguage('aaj baarish hogi kya?');
    assert.strictEqual(res.language, 'hi');
    assert.strictEqual(res.confidence, 'heuristic');
  });

  test('English query resolves to en with fallback confidence', async () => {
    const res = await resolver.resolveLanguage('Will it rain tomorrow in Jaipur?');
    assert.strictEqual(res.language, 'en');
    assert.strictEqual(res.confidence, 'fallback');
  });
});

describe('5. Error Subsystems & Safe Upstream Mapping', () => {
  test('RAGServiceError maps 400 location error to client-safe message', () => {
    const err = new RAGServiceError({ upstreamStatus: 400 });
    assert.strictEqual(err.statusCode, 400);
    assert.strictEqual(err.code, 'LOCATION_UNRESOLVABLE');
    assert.strictEqual(err.message, 'Unable to resolve location. Please confirm your city and try again.');
  });

  test('RAGServiceError maps 401 auth error to generic 502 without leaking secret', () => {
    const err = new RAGServiceError({ upstreamStatus: 401 });
    assert.strictEqual(err.statusCode, 502);
    assert.strictEqual(err.code, 'RAG_AUTH_ERROR');
    assert.ok(err.serverLog.includes('Internal RAG API key was rejected'));
    assert.strictEqual(err.message, 'Weather service configuration error. Please contact support.');
  });

  test('RAGServiceError maps 503 to AI busy message', () => {
    const err = new RAGServiceError({ upstreamStatus: 503 });
    assert.strictEqual(err.statusCode, 503);
    assert.strictEqual(err.message, 'Our AI systems are currently busy, please try again later.');
  });

  test('RAGServiceError maps timeout to 504 waking-up message', () => {
    const err = new RAGServiceError({ isTimeout: true });
    assert.strictEqual(err.statusCode, 504);
    assert.strictEqual(err.code, 'RAG_GATEWAY_TIMEOUT');
    assert.strictEqual(err.message, 'Weather service is waking up, please try again in a few seconds.');
  });

  test('Bhashini NMT failure is typed and distinct from weather error', () => {
    const err = new NMTError('Translation failed');
    assert.strictEqual(err.statusCode, 502);
    assert.strictEqual(err.code, 'NMT_ERROR');
  });
});

describe('6. Zod Request Validators', () => {
  test('validates chatBodySchema successfully for valid input', () => {
    const parsed = chatBodySchema.parse({
      query: 'Is it raining in Delhi?',
      location: 'Delhi',
      role: 'farmer',
      language: 'en',
    });
    assert.strictEqual(parsed.query, 'Is it raining in Delhi?');
    assert.strictEqual(parsed.role, 'farmer');
    assert.strictEqual(parsed.location, 'Delhi');
  });

  test('rejects empty query in chatBodySchema', () => {
    assert.throws(() => {
      chatBodySchema.parse({ query: '   ' });
    });
  });

  test('rejects invalid location characters (script injection or symbols)', () => {
    assert.throws(() => {
      chatBodySchema.parse({ query: 'test', location: 'Delhi<script>alert(1)</script>' });
    });
  });

  test('rejects unsupported role', () => {
    assert.throws(() => {
      chatBodySchema.parse({ query: 'test', role: 'admin_super_user' });
    });
  });

  test('rejects voiceChatBodySchema without language', () => {
    assert.throws(() => {
      voiceChatBodySchema.parse({});
    });
  });

  test('validates ttsBodySchema requiring text and language', () => {
    assert.throws(() => {
      ttsBodySchema.parse({ text: '' });
    });

    const valid = ttsBodySchema.parse({ text: 'Hello', language: 'hi' });
    assert.strictEqual(valid.language, 'hi');
    assert.strictEqual(valid.gender, 'female');
  });
});
