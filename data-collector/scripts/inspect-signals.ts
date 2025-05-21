import * as amqp from "amqplib";
import dotenv from "dotenv";
dotenv.config();

async function main() {
	const conn = await amqp.connect("amqp://user:pass@localhost:5672");
	const ch = await conn.createChannel();

	await ch.assertExchange("signals", "fanout", { durable: true });
	// anon exclusive queue
	const q = await ch.assertQueue("", { exclusive: true });
	await ch.bindQueue(q.queue, "signals", "");

	console.log(`[inspector] Waiting for messages in ${q.queue}. To exit press CTRL+C`);
	ch.consume(
		q.queue,
		(msg) => {
			if (!msg) return;
			const sig = JSON.parse(msg.content.toString());
			console.log("[inspector] Received signal:", sig);
			// no ack, it auto acks in this example
		},
		{ noAck: true }
	);
}

main().catch(console.error);
