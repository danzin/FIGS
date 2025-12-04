import { RabbitMQService } from "@financialsignalsgatheringsystem/common";
import dotenv from "dotenv";

dotenv.config();

async function injectPoison() {
	const rabbit = new RabbitMQService(process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672");

	try {
		await rabbit.connect();

		console.log("Sending malformed packagte");

		// Sending a 'market_data' message, but the price is "Not A Number"
		// The persister service expects a number.This should fail.
		const poisonPill = {
			type: "market_data",
			asset_symbol: "BTC",
			price: "This should be a number but it is a string",
			source: "ChaosMonkey",
			timestamp: new Date(),
		};

		await rabbit.publish("market_data", "", poisonPill as any);

		console.log("Malformed package sent to 'market_data' exchange.");

		setTimeout(async () => {
			await rabbit.close();
			process.exit(0);
		}, 500);
	} catch (error) {
		console.error("Failed to inject poison:", error);
	}
}

injectPoison();
