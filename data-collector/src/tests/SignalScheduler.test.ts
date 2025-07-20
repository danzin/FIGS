import cron from "node-cron";
import {
	DataSource,
	IndicatorDataPoint,
	TaskScheduler,
	ScheduledDataSource,
} from "@financialsignalsgatheringsystem/common";
import { MessageBroker } from "@financialsignalsgatheringsystem/common";

// Mock node-cron
jest.mock("node-cron", () => ({
	schedule: jest.fn().mockImplementation((cronExpression, func, options) => {
		const mockTask = {
			start: jest.fn(() => {
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
	fetch: jest.Mock<Promise<IndicatorDataPoint[]>>;

	constructor(key: string) {
		this.key = key;
		this.fetch = jest.fn().mockResolvedValue([
			{
				name: "mockSignal",
				time: new Date(),
				value: 123,
				source: this.key,
			},
		]);
	}
}

const mockMessageBroker: MessageBroker = {
	connect: jest.fn().mockResolvedValue(undefined),
	publish: jest.fn().mockResolvedValue(undefined),
	consume: jest.fn().mockResolvedValue("consumerTag"),
	close: jest.fn().mockResolvedValue(undefined),
	isConnected: jest.fn().mockReturnValue(true),
};

describe("SignalScheduler Dynamic Registration", () => {
	let scheduler: TaskScheduler;
	let mockTask: cron.ScheduledTask;

	beforeEach(() => {
		jest.clearAllMocks();
		scheduler = new TaskScheduler(mockMessageBroker);

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

		scheduler.registerSource(dynamicConfig);

		expect(cron.schedule).toHaveBeenCalledTimes(2);
		expect(cron.schedule).toHaveBeenCalledWith(dynamicConfig.schedule, expect.any(Function), {
			scheduled: false,
			timezone: "UTC",
		});

		expect(mockTask.start).toHaveBeenCalledTimes(1);

		const jobFn = (mockTask as any)._scheduledFunc;
		if (!jobFn) throw new Error("No scheduled function captured");
		await jobFn();

		expect(dynamicSource.fetch).toHaveBeenCalledTimes(1);
		expect(mockMessageBroker.publish).toHaveBeenCalledWith("signals", "", {
			name: "mockSignal",
			timestamp: expect.any(Date),
			value: 123,
			source: "dynamic_source_1",
		});
	});
});
