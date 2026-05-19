import { Router, type IRouter } from "express";
import healthRouter from "./health";
import resumeRouter from "./resume";
import authRouter from "./auth";
import adminRouter from "./admin";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(requireAuth);
router.use(resumeRouter);

export default router;
