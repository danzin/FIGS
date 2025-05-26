import { Router } from "express";
import { StatusController } from "../controllers/StatusController";

export function createStatusRoutes(statusController: StatusController): Router {
	const router = Router();

	router.get("/health", statusController.getHealth);
	router.get("/status", statusController.getSchedulerStatus);
	router.post("/trigger/:sourceKey", statusController.triggerSource);

	return router;
}
