import { documentAPI } from '../services/api.js';

/** Save a video's transcript as a searchable source for AI Tutor. */
export function indexVideoTranscript(video, topicId) {
  return documentAPI.createText({
    type: 'YOUTUBE',
    name: video.title.slice(0, 190),
    text: video.transcript,
    sourceUrl: video.url,
    topicId: topicId ?? video.topicId,
  });
}
