import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import authRouter from "./auth";
import techniciansRouter from "./technicians";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ordersRouter);
router.use(authRouter);
router.use(techniciansRouter);

export default router;
