import env from '../../config/env.js';
import {
  BHASHINI_ENDPOINTS,
  BHASHINI_TASK_TYPES,
  SUPPORTED_LANGUAGE_CODES,
} from '../../config/constants.js';
import bhashiniConfigService from './config.service.js';
import httpClient from '../../utils/http-client.js';
import { ASRError, UnsupportedLanguageError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';

export class ASRService {
  /**
   * Transcribes speech audio to text using Bhashini ASR.
   *
   * @param {Buffer|string} audioData - Raw audio Buffer or base64 audio string
   * @param {string} sourceLanguage - Required language code (ASR cannot auto-detect)
   * @param {string} [audioFormat='wav'] - 'wav' or 'mp3'
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribe(audioData, sourceLanguage, audioFormat = 'wav') {
    const lang = sourceLanguage?.toLowerCase();

    if (!SUPPORTED_LANGUAGE_CODES.includes(lang)) {
      throw new UnsupportedLanguageError(lang);
    }

    const base64Audio = Buffer.isBuffer(audioData)
      ? audioData.toString('base64')
      : audioData;

    if (!base64Audio || base64Audio.length === 0) {
      throw new ASRError('Audio payload is empty or invalid');
    }

    const languageConfig = { sourceLanguage: lang };
    const serviceId = await bhashiniConfigService.getServiceId(
      BHASHINI_TASK_TYPES.ASR,
      languageConfig
    );

    // CRITICAL: inputData.input[0].source must be empty string "", NEVER null.
    // Setting source to null returns 422 Unprocessable Entity from Bhashini.
    const payload = {
      pipelineTasks: [
        {
          taskType: BHASHINI_TASK_TYPES.ASR,
          config: {
            language: languageConfig,
            serviceId,
            audioFormat: audioFormat === 'mp3' ? 'mp3' : 'wav',
            samplingRate: 16000,
          },
        },
      ],
      inputData: {
        input: [{ source: '' }],
        audio: [{ audioContent: base64Audio }],
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
        timeoutMs: 25000,
        retries: 1,
      });

      if (!response.ok) {
        logger.error({ status: response.status, lang }, 'Bhashini ASR compute call failed');
        throw new ASRError(`ASR transcription failed for language '${lang}'`);
      }

      const data = await response.json();
      const transcript = data?.pipelineResponse?.[0]?.output?.[0]?.source;

      if (typeof transcript !== 'string') {
        throw new ASRError('Invalid transcription format returned by ASR service');
      }

      return transcript.trim();
    } catch (err) {
      if (err instanceof ASRError || err instanceof UnsupportedLanguageError) throw err;
      logger.error({ error: err.message, lang }, 'ASR speech processing error');
      throw new ASRError('Failed to process speech input');
    }
  }
}

export const asrService = new ASRService();
export default asrService;

