import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

// Health check endpoints for Cloud Run and container liveness probes
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Basic body parser middleware
app.use(express.json());

// Path to built static assets
const distPath = path.resolve(__dirname, 'dist');
const indexPath = path.resolve(distPath, 'index.html');

if (fs.existsSync(distPath)) {
  // Serve static files from dist
  app.use(express.static(distPath, {
    maxAge: '1d',
    index: false,
  }));

  // SPA fallback: any GET request not matched by static files returns index.html
  app.get('*', (_req, res) => {
    res.sendFile(indexPath);
  });
} else {
  // Fallback if dist hasn't been built yet
  app.get('*', (_req, res) => {
    res.status(200).send(`
      <!doctype html>
      <html>
        <head><title>ZSB AQUATICS</title></head>
        <body style="font-family: sans-serif; padding: 2rem; text-align: center;">
          <h2>ZSB AQUATICS - Business Control Center</h2>
          <p>Application is initializing. Please ensure "npm run build" has completed.</p>
        </body>
      </html>
    `);
  });
}

const server = app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

export default app;
