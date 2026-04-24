import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import authRouter from "./auth";
import techniciansRouter from "./technicians";
import adminRouter from "./admin";
import invoicesRouter from "./invoices";
import locationsRouter from "./locations";
import geoRouter from "./geo";
import uploadRouter from "./upload";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ordersRouter);
router.use(authRouter);
router.use(techniciansRouter);
router.use(adminRouter);
router.use(invoicesRouter);
router.use(locationsRouter);
router.use(geoRouter);
router.use(uploadRouter);

export default router;
