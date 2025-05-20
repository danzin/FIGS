import { Server } from "./server";
import { config } from "./utils/config";

const PORT = Number(process.env.PORT) || 3000;
const FRED_API_KEY = config.FRED_API_KEY!;

const server = new Server(PORT, FRED_API_KEY);
server.start();
