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

  /**
   * GET /api/city/resolve-pincode?pincode=<6-digit>
   * Resolves Indian postal code to city, state, and formatted label.
   */
  async resolvePincode(req, res, next) {
    try {
      const { pincode } = req.query;
      const result = await geocodingService.resolvePincode(pincode);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/city/search?q=<3-60 chars>
   * Searches places across India.
   */
  async searchPlaces(req, res, next) {
    try {
      const { q } = req.query;
      const results = await geocodingService.searchPlaces(q);
      res.status(200).json(results);
    } catch (err) {
      next(err);
    }
  }
}

export const geocodingController = new GeocodingController();
export default geocodingController;
