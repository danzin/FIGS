declare class DataCollectorApp {
    private messageBroker;
    private schedulerManager;
    private apiServer;
    private isShuttingDown;
    private healthService;
    private systemMonitor;
    constructor();
    start(): Promise<void>;
    private setupGracefulShutdown;
    private logSchedulerStatus;
}
export { DataCollectorApp };
//# sourceMappingURL=index.d.ts.map