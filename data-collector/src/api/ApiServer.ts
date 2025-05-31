import express, { Application } from "express";
import { SchedulerConfigManager } from "../SchedulerConfigManager";
import { TickerService } from "./services/TickerService";
import { TickerController } from "./controllers/TickerController";
import { StatusController } from "./controllers/StatusController";
import { createTickerRoutes } from "./routes/tickerRoutes";
import { createStatusRoutes } from "./routes/statusRoutes";
import { HealthService } from "../services/HealthService";

export class ApiServer {
	private app: Application;
	private tickerService: TickerService;
	private tickerController: TickerController;
	private statusController: StatusController;
	constructor(
		private schedulerManager: SchedulerConfigManager,
		healthService: HealthService
	) {
		this.app = express();
		this.tickerService = new TickerService(schedulerManager);
		this.tickerController = new TickerController(this.tickerService);
		this.statusController = new StatusController(this.schedulerManager, healthService);

		this.setupMiddleware();
		this.setupRoutes();
	}

	private setupMiddleware(): void {
		this.app.use(express.json());

		// Add request logging middleware
		this.app.use((req, res, next) => {
			console.log(`[API] ${req.method} ${req.path}`);
			next();
		});
	}

	private setupRoutes(): void {
		// Mount route modules
		this.app.use("/tickers", createTickerRoutes(this.tickerController));
		this.app.use("/", createStatusRoutes(this.statusController));

		// 404 handler
		// this.app.use("/*", (req, res) => {
		// 	res.status(404).json({
		// 		error: "Endpoint not found",
		// 		path: req.originalUrl,
		// 		method: req.method,
		// 	});
		// });
	}

	public getApp(): Application {
		return this.app;
	}

	public listen(port: number): void {
		this.app.listen(port, () => {
			console.log(`[ApiServer] HTTP API listening on port ${port}`);
		});
	}
}
