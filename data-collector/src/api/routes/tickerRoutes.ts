import { Router } from "express";
import { TickerController } from "../controllers/TickerController";
import { asyncHandler } from "../middleware/asyncHandler";

export function createTickerRoutes(tickerController: TickerController): Router {
  const router = Router();

  router.post("/add", asyncHandler(tickerController.addTicker));
  router.delete("/:sourceKey", tickerController.removeTicker);
  router.get("/", tickerController.listTickers);
  // router.get("/supported", tickerController.getSupportedOptions); Unavailable until I decide how to handle it
  router.get("/validate/:coinId", asyncHandler(tickerController.validateCoin));

  return router;
}
