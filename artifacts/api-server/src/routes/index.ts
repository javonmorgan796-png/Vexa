import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cryptoPricesRouter from "./crypto-prices";
import cryptoWalletRouter from "./crypto-wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cryptoPricesRouter);
router.use(cryptoWalletRouter);

export default router;
