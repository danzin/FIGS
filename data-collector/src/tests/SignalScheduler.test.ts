import cron from "node-cron";
import { SignalScheduler, ScheduledDataSource } from "../SignalScheduler";
import { DataSource } from "../datasources/Datasource";
import { MessageBroker } from "@financialsignalsgatheringsystem/common";

// Mock node-cron
jest.mock("node-cron", () => ({
	schedule: jest.fn().mockImplementation((cronExpression, func, options) => {
		const mockTask = {
			start: jest.fn(() => {
				// store the scheduled callback
				(mockTask as any)._scheduledFunc = func;
			}),
			stop: jest.fn(),
		};
		return mockTask as any;
	}),
}));

// Mock DataSource
class MockDataSource implements DataSource {
	key: string;
	fetch: jest.Mock<
		Promise<{
			name: string;
			time: Date;
			value: number;
			source: string;
		}>
	>;
	constructor(key: string) {
		this.key = key;
		this.fetch = jest.fn().mockResolvedValue({
			name: "mockSignal",
			timestamp: new Date(),
			value: 123,
			source: this.key,
		});
	}
}

// Mock MessageBroker
const mockMessageBroker: MessageBroker = {
	connect: jest.fn().mockResolvedValue(undefined),
	publish: jest.fn().mockResolvedValue(undefined),
	consume: jest.fn().mockResolvedValue("consumerTag"),
	close: jest.fn().mockResolvedValue(undefined),
	isConnected: jest.fn().mockReturnValue(true), // ← new method
};

describe("SignalScheduler Dynamic Registration", () => {
	let scheduler: SignalScheduler;
	let mockTask: cron.ScheduledTask;

	beforeEach(() => {
		jest.clearAllMocks();
		scheduler = new SignalScheduler(mockMessageBroker);

		// Capture the mock task for each schedule() call
		(cron.schedule as jest.Mock).mockImplementation((cronExpr, fn, opts) => {
			mockTask = {
				start: jest.fn(() => {
					(mockTask as any)._scheduledFunc = fn;
				}),
				stop: jest.fn(),
			} as any;
			return mockTask;
		});
	});

	afterEach(() => {
		scheduler.stop();
	});

	test("should schedule and execute a dynamically registered source", async () => {
		// await the async start so connect() resolves before scheduling
		await scheduler.start();

		const dynamicSource = new MockDataSource("dynamic_source_1");
		const dynamicConfig: ScheduledDataSource = {
			source: dynamicSource,
			schedule: "* * * * *",
			enabled: true,
			priority: "medium",
			maxRetries: 1,
			retryDelay: 1000,
			consecutiveFailures: 0,
		};

		// register after start
		scheduler.registerSource(dynamicConfig);

		// health check + dynamic registration = 2 schedules
		expect(cron.schedule).toHaveBeenCalledTimes(2);
		expect(cron.schedule).toHaveBeenCalledWith(dynamicConfig.schedule, expect.any(Function), {
			scheduled: false,
			timezone: "UTC",
		});

		// the dynamic task should have been .start()ed once
		expect(mockTask.start).toHaveBeenCalledTimes(1);

		// fire the job manually
		const jobFn = (mockTask as any)._scheduledFunc;
		if (!jobFn) throw new Error("No scheduled function captured");
		await jobFn();

		// verify the fetch → publish flow
		expect(dynamicSource.fetch).toHaveBeenCalledTimes(1);
		expect(mockMessageBroker.publish).toHaveBeenCalledWith("signals", "", {
			name: "mockSignal",
			timestamp: expect.any(Date),
			value: 123,
			source: "dynamic_source_1",
		});
	});
});
