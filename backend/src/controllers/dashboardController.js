import { getDashboardSummary } from '../services/dashboardService.js';

export async function summary(request, response) {
  const data = await getDashboardSummary(request.user.id);
  response.json({ success: true, data });
}
