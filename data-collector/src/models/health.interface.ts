export interface SystemHealth {
	status: "healthy" | "degraded" | "unhealthy";
	timestamp: string;
	uptime: number;
	components: {
		scheduler: ComponentHealth;
		messageBroker: ComponentHealth;
		dataSources: ComponentHealth;
		memory: ComponentHealth;
	};
	summary: {
		total: number;
		healthy: number;
		degraded: number;
		failing: number;
		enabled: number;
	};
}

export interface ComponentHealth {
	status: "healthy" | "degraded" | "unhealthy";
	message?: string;
	details?: any;
	lastChecked: string;
}
