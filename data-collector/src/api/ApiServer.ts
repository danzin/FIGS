import express, { Application } from "express";
import { Errors } from "@financialsignalsgatheringsystem/common";
import { SchedulerConfigManager } from "../SchedulerConfigManager";
import { TickerService } from "./services/TickerService";
import { TickerController } from "./controllers/TickerController";
import { StatusController } from "./controllers/StatusController";
import { createTickerRoutes } from "./routes/tickerRoutes";
import { createStatusRoutes } from "./routes/statusRoutes";
import { HealthService } from "../services/HealthService";
import { errorHandler } from "./middleware/errorHandler";

export class ApiServer {
  private app: Application;
  private tickerService: TickerService;
  private tickerController: TickerController;
  private statusController: StatusController;
  constructor(
    private schedulerManager: SchedulerConfigManager,
    healthService: HealthService,
  ) {
    this.app = express();
    this.tickerService = new TickerService(schedulerManager);
    this.tickerController = new TickerController(this.tickerService);
    this.statusController = new StatusController(
      this.schedulerManager,
      healthService,
    );

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

    this.app.use((req, _res, next) => {
      next(
        Errors.notFound("Route", req.originalUrl, {
          context: {
            method: req.method,
            operation: "resolveRoute",
            service: "data-collector-api",
          },
        }),
      );
    });

    this.app.use(errorHandler);
  }

  public getApp(): Application {
    return this.app;
  }

  public listen(port: number): void {
    const server = this.app.listen(port, () => {
      console.log(`[ApiServer] HTTP API listening on port ${port}`);
    });
    server.on('error', (err) => {
      console.error(`[ApiServer] Server error on port ${port}:`, err);
    });
  }
}
