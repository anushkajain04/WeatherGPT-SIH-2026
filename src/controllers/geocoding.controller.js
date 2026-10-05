import geocodingService from '../services/geocoding.service.js';

export class GeocodingController {
  /**
   * GET /api/city/resolve?lat=<number>&lon=<number>
   * Resolves coordinates to city, state, and formatted label.
   */
  async resolveCity(req, res, next) {
    try {
      const { lat, lon } = req.query;
      const result = await geocodingService.resolveCity(lat, lon);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const geocodingController = new GeocodingController();
export default geocodingController;
