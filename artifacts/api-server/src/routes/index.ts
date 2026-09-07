import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cryptoPricesRouter from "./crypto-prices";
import cryptoWalletRouter from "./crypto-wallet";
import paystackRouter from "./paystack";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cryptoPricesRouter);
router.use(cryptoWalletRouter);
router.use(paystackRouter);

export default router;
