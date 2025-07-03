"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiServer = void 0;
const express_1 = __importDefault(require("express"));
const TickerService_1 = require("./services/TickerService");
const TickerController_1 = require("./controllers/TickerController");
const StatusController_1 = require("./controllers/StatusController");
const tickerRoutes_1 = require("./routes/tickerRoutes");
const statusRoutes_1 = require("./routes/statusRoutes");
class ApiServer {
    constructor(schedulerManager, healthService) {
        this.schedulerManager = schedulerManager;
        this.app = (0, express_1.default)();
        this.tickerService = new TickerService_1.TickerService(schedulerManager);
        this.tickerController = new TickerController_1.TickerController(this.tickerService);
        this.statusController = new StatusController_1.StatusController(this.schedulerManager, healthService);
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use(express_1.default.json());
        // Add request logging middleware
        this.app.use((req, res, next) => {
            console.log(`[API] ${req.method} ${req.path}`);
            next();
        });
    }
    setupRoutes() {
        // Mount route modules
        this.app.use("/tickers", (0, tickerRoutes_1.createTickerRoutes)(this.tickerController));
        this.app.use("/", (0, statusRoutes_1.createStatusRoutes)(this.statusController));
        // 404 handler
        // this.app.use("/*", (req, res) => {
        // 	res.status(404).json({
        // 		error: "Endpoint not found",
        // 		path: req.originalUrl,
        // 		method: req.method,
        // 	});
        // });
    }
    getApp() {
        return this.app;
    }
    listen(port) {
        this.app.listen(port, () => {
            console.log(`[ApiServer] HTTP API listening on port ${port}`);
        });
    }
}
exports.ApiServer = ApiServer;
//# sourceMappingURL=ApiServer.js.map