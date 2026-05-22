import express from "express";
import cors from "cors";
import helmet from "helmet";
import "@/types"; // Load Express type augmentation (req.user, req.profile)
import { corsOptions } from "./config";
import { errorHandler } from "./middleware";
import router from "./routes";

const app = express();

// Security middleware
// Relax helmet's crossOriginResourcePolicy so assets load cross-origin
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Handle preflight OPTIONS requests before any other middleware
// Hostinger's reverse proxy passes OPTIONS through — this ensures they
// get a 200 with CORS headers before your auth middleware runs
app.options('*', cors(corsOptions));

// CORS — must come before routes
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Hostinger health check probe
app.get("/", (_req, res) => res.status(200).send("OK"));
app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

// Routes
app.use("/api", router);

// Error handling middleware
app.use(errorHandler);

export default app;
