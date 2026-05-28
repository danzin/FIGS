import { Router } from "express";
import { StatusController } from "../controllers/StatusController";
import { asyncHandler } from "../middleware/asyncHandler";

export function createStatusRoutes(statusController: StatusController): Router {
  const router = Router();

  router.get("/health", asyncHandler(statusController.getHealth));
  router.get("/status", statusController.getSchedulerStatus);
  router.post(
    "/trigger/:sourceKey",
    asyncHandler(statusController.triggerSource),
  );

  return router;
}
