import dashboardService from '../services/dashboard.service.js';

export class DashboardController {
  /**
   * GET /api/dashboard?location=<string>&role=<string>
   * Returns current weather, hourly forecast, 5-day daily forecast, AQI, alerts, and role advisory.
   */
  async getDashboard(req, res, next) {
    try {
      const location = req.query.location || 'Pune, Maharashtra';
      const role = req.query.role || 'normal_user';
      const lat = req.query.lat !== undefined ? req.query.lat : undefined;
      const lon = req.query.lon !== undefined ? req.query.lon : undefined;
      const data = await dashboardService.getDashboardData(location, role, { lat, lon });
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();
export default dashboardController;
