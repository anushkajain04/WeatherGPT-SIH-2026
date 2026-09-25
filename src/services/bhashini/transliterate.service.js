import env from '../../config/env.js';
import {
  BHASHINI_ENDPOINTS,
  BHASHINI_TASK_TYPES,
  SUPPORTED_LANGUAGE_CODES,
} from '../../config/constants.js';
import bhashiniConfigService from './config.service.js';
import httpClient from '../../utils/http-client.js';
import { BhashiniError, UnsupportedLanguageError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';

export class TransliterateService {
  /**
   * Transliterates romanized Latin-script text into native Indic script.
   *
   * @param {string} text - Romanized text
   * @param {string} targetLanguage - Indic target language code (e.g. 'hi', 'bn')
   * @returns {Promise<{ target: string, suggestions: string[] }>}
   */
  async transliterate(text, targetLanguage) {
    const tgt = targetLanguage?.toLowerCase();

    if (!SUPPORTED_LANGUAGE_CODES.includes(tgt)) {
      throw new UnsupportedLanguageError(tgt);
    }

    if (!text || !text.trim()) {
      return { target: '', suggestions: [] };
    }

    const languageConfig = { sourceLanguage: 'en', targetLanguage: tgt };
    const serviceId = await bhashiniConfigService.getServiceId(
      BHASHINI_TASK_TYPES.TRANSLITERATION,
      languageConfig
    );

    const payload = {
      pipelineTasks: [
        {
          taskType: BHASHINI_TASK_TYPES.TRANSLITERATION,
          config: {
            language: languageConfig,
            serviceId,
            isSentence: true,
            numSuggestions: 3,
          },
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
        timeoutMs: 15000,
        retries: 1,
      });

      if (!response.ok) {
        logger.error({ status: response.status, tgt }, 'Bhashini transliteration compute failed');
        throw new BhashiniError('Transliteration failed', 'TRANSLITERATION_ERROR');
      }

      const data = await response.json();
      const output = data?.pipelineResponse?.[0]?.output?.[0];
      const target = output?.target?.[0] || text;
      const suggestions = output?.target || [];

      return {
        target,
        suggestions,
      };
    } catch (err) {
      if (err instanceof BhashiniError || err instanceof UnsupportedLanguageError) throw err;
      logger.error({ error: err.message, tgt }, 'Transliteration network or service error');
      throw new BhashiniError('Transliteration service unreachable', 'TRANSLITERATION_UNREACHABLE');
    }
  }
}

export const transliterateService = new TransliterateService();
export default transliterateService;

