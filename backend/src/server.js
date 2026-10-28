import app from './app.js';
import { env } from './config/env.js';
import { documentIngestionService } from './services/rag/documentIngestionService.js';

const server = app.listen(env.port, () => {
  console.log(`Studylyx API listening on port ${env.port}`);
});

documentIngestionService.failStaleDocuments().catch((error) => {
  console.error('Could not recover interrupted document processing', error.message);
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(
      `Port ${env.port} is already in use. Kill the process using it (Windows: netstat -ano | findstr :${env.port} then taskkill /PID <pid> /F) or start with another port (Windows PowerShell: $env:PORT=5001; npm run dev).`,
    );
    process.exit(1);
  }
  throw error;
});

