import ttsService from '../services/bhashini/tts.service.js';

export class TTSController {
  /**
   * POST /api/tts
   * On-demand text-to-speech generation. Returns WAV audio stream or base64 JSON.
   */
  async handleTTS(req, res, next) {
    try {
      const { text, language, gender = 'female' } = req.body;
      const wantsJson =
        req.query.format === 'json' ||
        req.headers.accept?.includes('application/json');

      const { audioBuffer, base64Audio, mimeType } = await ttsService.synthesize(
        text,
        language,
        { gender, returnBuffer: !wantsJson || true }
      );

      req.log.info(
        { language, gender, textLength: text.length, audioBytes: audioBuffer?.length },
        'TTS audio generated successfully'
      );

      if (wantsJson) {
        return res.status(200).json({
          status: 'ok',
          language,
          mimeType,
          format: 'wav',
          audioContent: base64Audio,
        });
      }

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', audioBuffer.length);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache audio for 24h

      res.status(200).send(audioBuffer);
    } catch (err) {
      next(err);
    }
  }
}

export const ttsController = new TTSController();
export default ttsController;

