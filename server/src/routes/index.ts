import { Router } from "express";
import authRoutes from "./authRoutes";
import userRoutes from "./userRoutes";
import examRoutes from "./examRoutes";
import sessionRoutes from "./sessionRoutes";
import monitoringRoutes from "./monitoringRoutes";
import alertRoutes from "./alertRoutes";
import reportRoutes from "./reportRoutes";
import dashboardRoutes from "./dashboardRoutes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ExamSentinel API" });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/exams", examRoutes);
router.use("/sessions", sessionRoutes);
router.use("/sessions", monitoringRoutes);
router.use("/alerts", alertRoutes);
router.use("/", reportRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
