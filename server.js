// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = parseInt(process.env.PORT || "3000", 10);
var HOST = "0.0.0.0";
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.use(express.json());
var distPath = path.resolve(__dirname, "dist");
var indexPath = path.resolve(distPath, "index.html");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    maxAge: "1d",
    index: false
  }));
  app.get("*", (_req, res) => {
    res.sendFile(indexPath);
  });
} else {
  app.get("*", (_req, res) => {
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
var server = app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});
process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});
var server_default = app;
export {
  server_default as default
};
