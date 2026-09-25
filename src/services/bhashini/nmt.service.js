import env from '../../config/env.js';
import {
  BHASHINI_ENDPOINTS,
  BHASHINI_TASK_TYPES,
  SUPPORTED_LANGUAGE_CODES,
} from '../../config/constants.js';
import bhashiniConfigService from './config.service.js';
import httpClient from '../../utils/http-client.js';
import { NMTError, UnsupportedLanguageError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';

export class NMTService {
  /**
   * Translates text from sourceLanguage to targetLanguage.
   *
   * @param {string} text - Text to translate
   * @param {string} sourceLanguage - ISO language code (e.g. 'hi', 'en')
   * @param {string} targetLanguage - ISO language code (e.g. 'en', 'hi')
   * @returns {Promise<string>} - Translated text
   */
  async translate(text, sourceLanguage, targetLanguage) {
    if (!text || !text.trim()) return '';

    const src = sourceLanguage?.toLowerCase();
    const tgt = targetLanguage?.toLowerCase();

    // Skip translation if languages match
    if (src === tgt) {
      return text;
    }

    // Validate supported languages (fail cleanly on unsupported non-scheduled languages)
    if (!SUPPORTED_LANGUAGE_CODES.includes(src)) {
      throw new UnsupportedLanguageError(src);
    }
    if (!SUPPORTED_LANGUAGE_CODES.includes(tgt)) {
      throw new UnsupportedLanguageError(tgt);
    }

    const languagePair = { sourceLanguage: src, targetLanguage: tgt };
    const serviceId = await bhashiniConfigService.getServiceId(
      BHASHINI_TASK_TYPES.TRANSLATION,
      languagePair
    );

    const payload = {
      pipelineTasks: [
        {
          taskType: BHASHINI_TASK_TYPES.TRANSLATION,
          config: {
            language: languagePair,
            serviceId,
          },
        },
      ],
      inputData: {
        input: [{ source: text }],
        audio: [{ audioContent: null }],
      },
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
        logger.error(
          { status: response.status, src, tgt },
          'Bhashini NMT compute call failed'
        );
        throw new NMTError(`Translation failed from ${src} to ${tgt}`);
      }

      const data = await response.json();
      const translated = data?.pipelineResponse?.[0]?.output?.[0]?.target;

      if (!translated && translated !== '') {
        throw new NMTError('Empty or invalid translation payload returned by upstream NMT');
      }

      return translated;
    } catch (err) {
      if (err instanceof NMTError || err instanceof UnsupportedLanguageError) throw err;
      logger.error({ error: err.message, src, tgt }, 'NMT network or parsing error');
      throw new NMTError(`Failed to translate text from ${src} to ${tgt}`);
    }
  }
}

export const nmtService = new NMTService();
export default nmtService;

