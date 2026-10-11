import languageResolverService from '../services/language-resolver.service.js';
import sessionService from '../services/session.service.js';
import nmtService from '../services/bhashini/nmt.service.js';
import asrService from '../services/bhashini/asr.service.js';
import ragService from '../services/rag.service.js';
import { ValidationError } from '../utils/errors.js';

export class ChatController {
  /**
   * Orchestrates the common chat pipeline after query is available.
   *
   * @param {object} req - Express request
   * @param {object} params
   * @param {string} params.rawQuery - User query in natural or romanized text
   * @param {string} [params.role='normal_user']
   * @param {string} [params.location] - Unmodified Latin-script geolocation
   * @param {string} [params.explicitLanguage]
   * @param {string} [params.sessionId]
   * @returns {Promise<object>} - Complete chat response payload
   */
  async executeChatPipeline(req, { rawQuery, role = 'normal_user', location = '', explicitLanguage = null, sessionId = null, lat = null, lon = null }) {
    const startTime = Date.now();
    const timings = {
      detect: 0,
      rewrite: 0,
      translateIn: 0,
      rag: 0,
      translateOut: 0,
      total: 0,
    };

    // 1. Language Resolution Stage
    const detectStart = Date.now();
    const { language: detectedLanguage, confidence: languageConfidence } =
      await languageResolverService.resolveLanguage(rawQuery, explicitLanguage);
    timings.detect = Date.now() - detectStart;

    // 2. Session Context & Follow-Up Rewriting Stage
    const rewriteStart = Date.now();
    const { rewrittenQuery, effectiveLocation } =
      sessionService.rewriteFollowUp(sessionId, rawQuery, location);
    timings.rewrite = Date.now() - rewriteStart;

    // 3. Input Translation to English Stage (skip if already English)
    const translateInStart = Date.now();
    let englishQuery = rewrittenQuery;

    if (detectedLanguage !== 'en') {
      englishQuery = await nmtService.translate(rewrittenQuery, detectedLanguage, 'en');
    }
    timings.translateIn = Date.now() - translateInStart;

    // 4. Upstream RAG Query Stage
    // Note: effectiveLocation MUST stay original Latin-script string for upstream geocoder.
    const ragStart = Date.now();
    const ragResult = await ragService.queryRAG({
      query: englishQuery,
      role,
      location: effectiveLocation || '',
      lat,
      lon,
    });
    timings.rag = Date.now() - ragStart;

    const answerEnglish = ragResult.answer;
    let finalAnswer = answerEnglish;
    let translationFailed = false;

    // 5. Output Translation Stage (English back to detectedLanguage)
    const translateOutStart = Date.now();
    if (detectedLanguage !== 'en') {
      try {
        finalAnswer = await nmtService.translate(answerEnglish, 'en', detectedLanguage);
      } catch (err) {
        // Graceful degradation: If Bhashini translation fails but RAG succeeded,
        // return the English answer with translationFailed flag rather than failing the request.
        req.log.warn(
          { error: err.message, detectedLanguage },
          'Graceful degradation: Upstream RAG succeeded but output translation failed; returning English answer'
        );
        finalAnswer = answerEnglish;
        translationFailed = true;
      }
    }
    timings.translateOut = Date.now() - translateOutStart;
    timings.total = Date.now() - startTime;

    // 6. Save Turn to Session Store (keeps last 3 turns and effective location)
    if (sessionId) {
      sessionService.saveTurn(sessionId, {
        query: rawQuery,
        answer: finalAnswer,
        location: effectiveLocation,
        language: detectedLanguage,
      });
    }

    req.log.info(
      {
        detectedLanguage,
        languageConfidence,
        route: ragResult.route,
        model_used: ragResult.model_used,
        timings,
        isCached: !!ragResult.isCached,
        translationFailed,
      },
      'Chat request completed successfully'
    );

    return {
      answer: finalAnswer,
      answerEnglish,
      detectedLanguage,
      languageConfidence,
      translationFailed,
      route: ragResult.route,
      model_used: ragResult.model_used,
      latency: ragResult.latency_seconds,
      location_resolved: ragResult.location_resolved,
      weatherUnavailable: !!ragResult.weatherUnavailable,
      timings,
    };
  }

  /**
   * POST /api/chat
   * Text-based multilingual weather chat.
   */
  async handleChat(req, res, next) {
    try {
      const { query, role, location, language, sessionId, lat, lon } = req.body;

      const responsePayload = await this.executeChatPipeline(req, {
        rawQuery: query,
        role,
        location,
        explicitLanguage: language,
        sessionId,
        lat,
        lon,
      });

      res.status(200).json(responsePayload);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/chat/voice
   * Audio-based voice chat (Multer memory upload + ASR).
   */
  async handleVoiceChat(req, res, next) {
    try {
      if (!req.file) {
        throw new ValidationError('Audio file is required in field "audio" (WAV or MP3, max 5MB)');
      }

      const { language, role, location, sessionId } = req.body;

      const asrStart = Date.now();
      const transcript = await asrService.transcribe(
        req.file.buffer,
        language,
        req.file.mimetype.includes('mp3') ? 'mp3' : 'wav'
      );
      const asrTimeMs = Date.now() - asrStart;

      if (!transcript) {
        throw new ValidationError('No speech could be recognized in the provided audio file');
      }

      req.log.info({ transcript, language, asrTimeMs }, 'Voice input transcribed successfully');

      const responsePayload = await this.executeChatPipeline(req, {
        rawQuery: transcript,
        role,
        location,
        explicitLanguage: language,
        sessionId,
      });

      responsePayload.transcript = transcript;
      responsePayload.timings.asr = asrTimeMs;
      responsePayload.timings.total += asrTimeMs;

      res.status(200).json(responsePayload);
    } catch (err) {
      next(err);
    }
  }
}

export const chatController = new ChatController();
export default chatController;

