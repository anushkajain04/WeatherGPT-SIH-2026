import ragService from '../services/rag.service.js';
import bhashiniConfigService from '../services/bhashini/config.service.js';
import nmtService from '../services/bhashini/nmt.service.js';
import { BHASHINI_TASK_TYPES } from '../config/constants.js';

export class HealthController {
  /**
   * GET /api/health
   * Own liveness plus cached upstream RAG check.
   */
  async getHealth(req, res, next) {
    try {
      const ragHealth = await ragService.checkHealth();

      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        upstream: {
          rag: ragHealth.status,
          ragLatencyMs: ragHealth.latencyMs,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/status
   * Detailed per-subsystem health (RAG, Bhashini Config, NMT) for debugging and demos.
   */
  async getStatus(req, res, next) {
    const results = {
      timestamp: new Date().toISOString(),
      subsystems: {
        rag: { status: 'unknown', latencyMs: 0 },
        bhashiniConfig: { status: 'unknown', latencyMs: 0 },
        bhashiniNmt: { status: 'unknown', latencyMs: 0 },
      },
      overall: 'ok',
    };

    // 1. Check Upstream RAG
    try {
      const ragHealth = await ragService.checkHealth();
      results.subsystems.rag = ragHealth;
      if (ragHealth.status === 'down') results.overall = 'degraded';
    } catch (err) {
      results.subsystems.rag = { status: 'down', error: 'Unreachable' };
      results.overall = 'degraded';
    }

    // 2. Check Bhashini Config
    const configStart = Date.now();
    try {
      await bhashiniConfigService.getServiceId(BHASHINI_TASK_TYPES.TRANSLATION, {
        sourceLanguage: 'en',
        targetLanguage: 'hi',
      });
      results.subsystems.bhashiniConfig = {
        status: 'ok',
        latencyMs: Date.now() - configStart,
      };
    } catch (err) {
      results.subsystems.bhashiniConfig = {
        status: 'degraded',
        latencyMs: Date.now() - configStart,
        message: err.message,
      };
      results.overall = 'degraded';
    }

    // 3. Check Bhashini NMT
    const nmtStart = Date.now();
    try {
      const testTranslation = await nmtService.translate('hi', 'en', 'hi');
      results.subsystems.bhashiniNmt = {
        status: testTranslation ? 'ok' : 'degraded',
        latencyMs: Date.now() - nmtStart,
      };
    } catch (err) {
      results.subsystems.bhashiniNmt = {
        status: 'degraded',
        latencyMs: Date.now() - nmtStart,
        message: err.message,
      };
      results.overall = 'degraded';
    }

    res.status(results.overall === 'ok' ? 200 : 207).json(results);
  }
}

export const healthController = new HealthController();
export default healthController;

