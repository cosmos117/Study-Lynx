import { getMotivationToday } from '../services/motivationService.js';

export function today(_request, response) {
  response.json({ success: true, data: { motivation: getMotivationToday() } });
}
