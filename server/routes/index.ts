import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cryptoPricesRouter from "./crypto-prices";
import cryptoWalletRouter from "./crypto-wallet";
import paystackRouter from "./paystack";
import termiiRouter from "./termii";
import securityRouter from "./security";
import adminRouter from "./admin";
import bettingRouter from "./betting";
import telecomRouter from "./telecom";
import authRouter from "./auth";
import walletRouter from "./wallet";
import businessRouter from "./business";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cryptoPricesRouter);
router.use(cryptoWalletRouter);
router.use(paystackRouter);
router.use(termiiRouter);
router.use(securityRouter);
router.use(adminRouter);
router.use(bettingRouter);
router.use(telecomRouter);
router.use(authRouter);
router.use(walletRouter);
router.use(businessRouter);

export default router;
