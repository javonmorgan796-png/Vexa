import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cryptoPricesRouter from "./crypto-prices";
import cryptoWalletRouter from "./crypto-wallet";
import paystackRouter from "./paystack";
import termiiRouter from "./termii";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cryptoPricesRouter);
router.use(cryptoWalletRouter);
router.use(paystackRouter);
router.use(termiiRouter);

export default router;
