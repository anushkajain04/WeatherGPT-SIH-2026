import env from '../config/env.js';
import {
  BHASHINI_ENDPOINTS,
  BHASHINI_TASK_TYPES,
  BHASHINI_TLD_SERVICE_ID,
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
} from '../config/constants.js';
import { detectRomanizedHindi } from '../config/romanized-keywords.js';
import httpClient from '../utils/http-client.js';
import { UnsupportedLanguageError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export class LanguageResolverService {
  /**
   * Calls Bhashini Text Language Detection (TLD) API.
   *
   * @param {string} text
   * @returns {Promise<Array<{ langCode: string, scriptCode: string, langScore: number }>>}
   */
  async detectWithBhashiniTLD(text) {
    const payload = {
      pipelineTasks: [
        {
          taskType: BHASHINI_TASK_TYPES.TLD,
          config: { serviceId: BHASHINI_TLD_SERVICE_ID },
        },
      ],
      inputData: { input: [{ source: text }] },
    };

    try {
      const response = await httpClient(BHASHINI_ENDPOINTS.COMPUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: env.BHASHINI_INFERENCE_KEY,
        },
        body: JSON.stringify(payload),
        timeoutMs: 10000,
        retries: 1,
      });

      if (!response.ok) {
        logger.warn(
          { status: response.status },
          'Bhashini TLD call returned non-OK status; falling back to heuristic'
        );
        return [];
      }

      const data = await response.json();
      const predictions = data?.pipelineResponse?.[0]?.output?.[0]?.langPrediction;
      return Array.isArray(predictions) ? predictions : [];
    } catch (err) {
      logger.warn({ error: err.message }, 'Bhashini TLD call failed; proceeding with fallback heuristic');
      return [];
    }
  }

  /**
   * Resolves language with the prioritized resolution logic:
   * 1. Explicit request language wins
   * 2. Bhashini TLD native-script detection
   * 3. Romanized Hinglish keyword heuristic (bridges Bhashini's Latin-script limitation)
   * 4. Fallback to English ('en')
   *
   * @param {string} text - User query text
   * @param {string} [explicitLanguage] - Language passed explicitly in request
   * @returns {Promise<{ language: string, confidence: 'explicit'|'high'|'heuristic'|'fallback' }>}
   */
  async resolveLanguage(text, explicitLanguage = null) {
    // 1. Explicit language in request always wins
    if (explicitLanguage && typeof explicitLanguage === 'string') {
      const normalized = explicitLanguage.trim().toLowerCase();
      if (SUPPORTED_LANGUAGE_CODES.includes(normalized)) {
        logger.debug({ language: normalized }, 'Language resolved via explicit parameter');
        return { language: normalized, confidence: 'explicit' };
      }
      throw new UnsupportedLanguageError(normalized);
    }

    if (!text || !text.trim()) {
      return { language: 'en', confidence: 'fallback' };
    }

    // 2. Call Bhashini TLD
    const predictions = await this.detectWithBhashiniTLD(text);
    const topPrediction = predictions[0];

    if (topPrediction) {
      const detectedCode = topPrediction.langCode?.toLowerCase();
      const scriptCode = topPrediction.scriptCode;

      // If TLD detected a native-script Indic language (and not 'en' / Latin)
      if (
        detectedCode &&
        detectedCode !== 'en' &&
        scriptCode !== 'Latn' &&
        SUPPORTED_LANGUAGE_CODES.includes(detectedCode)
      ) {
        logger.debug(
          { detectedCode, scriptCode, score: topPrediction.langScore },
          'Language resolved via Bhashini native-script TLD'
        );
        return { language: detectedCode, confidence: 'high' };
      }
    }

    // 3. TLD returned 'en' or failed: Check romanized Indic (Hinglish) keyword heuristic
    // Note: Bhashini TLD labels all Latin-script text as 'en'. This is a platform limitation.
    const heuristicResult = detectRomanizedHindi(text);
    if (heuristicResult.isMatch) {
      logger.debug(
        { matchedKeywords: heuristicResult.matchedKeywords },
        'Language resolved to Hindi (hi) via romanized keyword heuristic'
      );
      return { language: 'hi', confidence: 'heuristic' };
    }

    // 4. Fall back to English
    logger.debug('Language resolved to English via default fallback');
    return { language: 'en', confidence: 'fallback' };
  }
}

export const languageResolverService = new LanguageResolverService();
export default languageResolverService;

