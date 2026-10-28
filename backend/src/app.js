import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorMiddleware, notFoundMiddleware } from './middleware/errorMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import examRoutes from './routes/examRoutes.js';
import subjectRoutes from './routes/subjectRoutes.js';
import topicRoutes from './routes/topicRoutes.js';
import motivationRoutes from './routes/motivationRoutes.js';
import learningRoutes from './routes/learningRoutes.js';
import studySessionRoutes from './routes/studySessionRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import tutorRoutes from './routes/tutorRoutes.js';
import topicHubRoutes from './routes/topicHubRoutes.js';
import insightsRoutes from './routes/insightsRoutes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    message: 'Studylyx API is running',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/exams', examRoutes);
app.use('/api', subjectRoutes);
app.use('/api', topicRoutes);
app.use('/api/motivation', motivationRoutes);
app.use('/api', learningRoutes);
app.use('/api', topicHubRoutes);
app.use('/api', insightsRoutes);
app.use('/api/study-sessions', studySessionRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/ai-tutor', tutorRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
