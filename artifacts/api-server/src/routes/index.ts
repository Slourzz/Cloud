import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ttmlRouter from "./ttml";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ttmlRouter);

export default router;
