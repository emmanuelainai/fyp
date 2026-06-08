import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env";
import apiRoutes from "./routes";
import { errorHandler, notFound } from "./middlewares/errorHandler";

export const createApp = () => {
  const app = express();
  const allowedOrigins = new Set([env.CLIENT_URL, "http://localhost:5173", "http://127.0.0.1:5173"]);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin) || /^http:\/\/(?:\d{1,3}\.){3}\d{1,3}:5173$/.test(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked origin: ${origin}`));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(`/${env.UPLOAD_DIR}`, express.static(path.resolve(process.cwd(), env.UPLOAD_DIR)));

  app.use("/api", apiRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
