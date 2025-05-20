import express from "express";
import { Gatherer } from "./gatherer";
import { FredSource } from "./datasources/fred";
import { datapoints } from "./utils/datapoints";
export class Server {
	private app = express();
	private port: number;
	private gatherer: Gatherer;

	constructor(port: number, fredApiKey: string) {
		this.port = port;
		const sources = [
			new FredSource(fredApiKey, datapoints.get("FREDM2") as string),
		];
		this.gatherer = new Gatherer(sources);
		this.setupMiddleware();
		this.setupRoutes();
	}

	private setupMiddleware() {
		this.app.use(express.json());
	}

	private setupRoutes() {
		this.app.get("/api/signals", async (req, res) => {
			try {
				const data = await this.gatherer.collectAll();
				res.json(data);
			} catch (error) {
				// logger.error("Error fetching signals:", { error });
				console.error("Error fetching signals:", error);
				res.status(500).json({
					error: "Internal Server Error",
					message: "Failed to retrieve signals",
				});
			}
		});
	}

	public start() {
		try {
			this.app.listen(this.port, () => {
				console.log(`Server running on port ${this.port}`);
			});
		} catch (error) {
			console.error("Error starting server:", error);
			process.exit(1);
		}
	}
}
