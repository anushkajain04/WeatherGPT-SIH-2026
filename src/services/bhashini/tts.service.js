import env from '../../config/env.js';
import {
  BHASHINI_ENDPOINTS,
  BHASHINI_TASK_TYPES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
} from '../../config/constants.js';
import bhashiniConfigService from './config.service.js';
import httpClient from '../../utils/http-client.js';
import { TTSError, UnsupportedLanguageError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';

export class TTSService {
  /**
   * Synthesizes text to speech audio.
   *
   * @param {string} text - Text to synthesize
   * @param {string} language - Target language code
   * @param {object} options
   * @param {'female'|'male'} [options.gender='female'] - Voice gender
   * @param {boolean} [options.returnBuffer=true] - If true, returns binary Buffer; else base64 string
   * @returns {Promise<{ audioBuffer: Buffer, base64Audio: string, mimeType: string }>}
   */
  async synthesize(text, language, { gender = 'female', returnBuffer = true } = {}) {
    const lang = language?.toLowerCase();

    if (!SUPPORTED_LANGUAGE_CODES.includes(lang)) {
      throw new UnsupportedLanguageError(lang);
    }

    if (!text || !text.trim()) {
      throw new TTSError('Text for synthesis cannot be empty');
    }

    const serviceId = await bhashiniConfigService.getServiceId(
      BHASHINI_TASK_TYPES.TTS,
      { sourceLanguage: lang }
    );

    const languageConfig = { sourceLanguage: lang };

    // CRITICAL: Set sourceScriptCode explicitly for native-script languages (e.g. Beng for Bengali)
    // or audio returns near-silent from Bhashini.
    const langMeta = SUPPORTED_LANGUAGES[lang];
    if (langMeta && langMeta.native && langMeta.scriptCode) {
      languageConfig.sourceScriptCode = langMeta.scriptCode;
    }

    const payload = {
      pipelineTasks: [
        {
          taskType: BHASHINI_TASK_TYPES.TTS,
          config: {
            language: languageConfig,
            serviceId,
            gender,
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
        timeoutMs: 25000,
        retries: 1,
      });

      if (!response.ok) {
        logger.error({ status: response.status, lang }, 'Bhashini TTS compute call failed');
        throw new TTSError(`Speech synthesis failed for language '${lang}'`);
      }

      const data = await response.json();
      const base64Audio = data?.pipelineResponse?.[0]?.audio?.[0]?.audioContent;

      if (!base64Audio) {
        throw new TTSError('Empty audio content returned by TTS service');
      }

      const audioBuffer = returnBuffer ? Buffer.from(base64Audio, 'base64') : null;

      return {
        audioBuffer,
        base64Audio,
        mimeType: 'audio/wav',
      };
    } catch (err) {
      if (err instanceof TTSError || err instanceof UnsupportedLanguageError) throw err;
      logger.error({ error: err.message, lang }, 'TTS processing failure');
      throw new TTSError('Failed to generate speech audio');
    }
  }
}

export const ttsService = new TTSService();
export default ttsService;

