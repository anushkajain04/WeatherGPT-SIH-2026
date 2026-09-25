import env from '../../config/env.js';
import {
  BHASHINI_ENDPOINTS,
  BHASHINI_PIPELINE_ID,
  CACHE_TTLS,
} from '../../config/constants.js';
import cacheService from '../cache.service.js';
import httpClient from '../../utils/http-client.js';
import { BhashiniError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';

const CONFIG_CACHE_PREFIX = 'bhashini:config:';

/**
 * Bhashini Configuration Service.
 * Resolves task serviceIds using the MeitY pipeline and caches results for ~24 hours.
 */
export class BhashiniConfigService {
  /**
   * Retrieves the dynamic serviceId for a given task and language configuration.
   *
   * @param {string} taskType - 'translation' | 'asr' | 'tts' | 'transliteration'
   * @param {object} languageConfig - e.g. { sourceLanguage: 'en', targetLanguage: 'hi' }
   * @returns {Promise<string>} - Resolved serviceId
   */
  async getServiceId(taskType, languageConfig) {
    const cacheKey = `${CONFIG_CACHE_PREFIX}${taskType}:${JSON.stringify(languageConfig)}`;
    const cachedServiceId = cacheService.get(cacheKey);

    if (cachedServiceId) {
      logger.debug(
        { taskType, languageConfig, serviceId: cachedServiceId },
        'Bhashini serviceId resolved from 24h cache'
      );
      return cachedServiceId;
    }

    const payload = {
      pipelineTasks: [
        {
          taskType,
          config: { language: languageConfig },
        },
      ],
      pipelineRequestConfig: { pipelineId: BHASHINI_PIPELINE_ID },
    };

    logger.debug({ taskType, languageConfig }, 'Fetching Bhashini serviceId from config endpoint...');

    try {
      const response = await httpClient(BHASHINI_ENDPOINTS.CONFIG, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ulcaApiKey: env.BHASHINI_UDYAT_KEY,
        },
        body: JSON.stringify(payload),
        timeoutMs: 15000,
        retries: 1,
      });

      if (!response.ok) {
        logger.error(
          { status: response.status, taskType },
          'Bhashini config call failed with upstream error'
        );
        throw new BhashiniError(
          'Failed to configure language pipeline',
          'BHASHINI_CONFIG_ERROR'
        );
      }

      const data = await response.json();
      const taskConfig = data?.pipelineResponseConfig?.find((t) => t.taskType === taskType);
      const serviceId = taskConfig?.config?.[0]?.serviceId;

      if (!serviceId) {
        logger.error(
          { taskType, languageConfig },
          'No compatible serviceId found in Bhashini pipeline response'
        );
        throw new BhashiniError(
          `No language service found for task '${taskType}'`,
          'BHASHINI_SERVICE_NOT_FOUND'
        );
      }

      // Cache resolved serviceId for ~24 hours
      cacheService.set(cacheKey, serviceId, CACHE_TTLS.BHASHINI_CONFIG_TTL_MS);
      logger.info(
        { taskType, serviceId, ttlMs: CACHE_TTLS.BHASHINI_CONFIG_TTL_MS },
        'Cached Bhashini serviceId'
      );

      return serviceId;
    } catch (err) {
      if (err instanceof BhashiniError) throw err;
      logger.error({ err: err.message, taskType }, 'Bhashini config resolution network failure');
      throw new BhashiniError(
        'Language pipeline configuration unreachable',
        'BHASHINI_CONFIG_UNREACHABLE'
      );
    }
  }
}

export const bhashiniConfigService = new BhashiniConfigService();
export default bhashiniConfigService;

