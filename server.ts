import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import apiApp from "./server/app";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const isProduction = process.env.NODE_ENV === "production";

// Mount API server handlers
app.use(apiApp);

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Vexa] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[Vexa] Failed to start server:", err);
  process.exit(1);
});
