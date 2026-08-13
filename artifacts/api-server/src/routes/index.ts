import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cryptoPricesRouter from "./crypto-prices";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cryptoPricesRouter);

export default router;
