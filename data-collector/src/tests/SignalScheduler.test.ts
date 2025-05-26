import cron from "node-cron";
import { SignalScheduler, ScheduledDataSource } from "../SignalScheduler";
import { DataSource } from "../datasources/Datasource"; // Adjusted import
import { MessageBroker } from "../services/messaging.interface"; // Adjusted import

// Mock node-cron
jest.mock("node-cron", () => ({
	schedule: jest.fn().mockImplementation((cronExpression, func, options) => {
		// Mock the task object
		const mockTask = {
			start: jest.fn(() => {}),
			stop: jest.fn(),
		};
		// Store the scheduled function to potentially call it manually if needed
		(mockTask.start as any)._scheduledFunc = func;
		return mockTask;
	}),
}));

// Mock DataSource
class MockDataSource implements DataSource {
	key: string;
	constructor(key: string) {
		this.key = key;
		// Initialize fetch here after this.key is set
		this.fetch = jest.fn().mockResolvedValue({
			name: "mockSignal",
			timestamp: new Date(),
			value: 123,
			source: this.key,
		});
	}
	// Declare fetch type
	fetch: jest.Mock<Promise<{ name: string; timestamp: Date; value: number; source: string }>>;
}

// Mock MessageBroker
const mockMessageBroker: MessageBroker = {
	publish: jest.fn().mockResolvedValue(undefined),
	connect: jest.fn().mockResolvedValue(undefined),
	consume: jest.fn().mockResolvedValue("consumerTag"),
	close: jest.fn().mockResolvedValue(undefined),
};

describe("SignalScheduler Dynamic Registration", () => {
	let scheduler: SignalScheduler;
	let mockTask: cron.ScheduledTask; // To hold the reference to the mocked task

	beforeEach(() => {
		jest.clearAllMocks();

		scheduler = new SignalScheduler(mockMessageBroker);

		// Capture the mock task created by cron.schedule
		(cron.schedule as jest.Mock).mockImplementation((cronExpression, func, options) => {
			mockTask = {
				start: jest.fn(() => {
					// Store the function to be called
					(mockTask as any)._scheduledFunc = func;
				}),
				stop: jest.fn(),
			} as any;
			return mockTask;
		});
	});

	afterEach(() => {
		scheduler.stop(); // Ensure scheduler is stopped after each test
	});

	test("should schedule and execute a dynamically registered source", async () => {
		// Start the scheduler
		scheduler.start(); // This will schedule any pre-existing sources (none in this test case initially)

		const dynamicSource = new MockDataSource("dynamic_source_1");
		const dynamicConfig: ScheduledDataSource = {
			source: dynamicSource,
			schedule: "* * * * *", // Every minute for testing
			enabled: true,
			priority: "medium",
			maxRetries: 1,
			retryDelay: 1000,
			consecutiveFailures: 0,
		};

		// Dynamically register the new source AFTER scheduler has started
		scheduler.registerSource(dynamicConfig);

		// Verify that cron.schedule was called for the dynamic source
		// The first call to cron.schedule is for health monitoring.
		// The second call should be for the dynamically added source.
		expect(cron.schedule).toHaveBeenCalledTimes(2);
		expect(cron.schedule).toHaveBeenCalledWith(dynamicConfig.schedule, expect.any(Function), {
			scheduled: false,
			timezone: "UTC",
		});

		// Verify that the task for the dynamic source was started
		expect(mockTask.start).toHaveBeenCalledTimes(1);

		// Simulate the cron job execution for the dynamic source
		// by directly calling the function passed to cron.schedule
		// (mockTask as any) is used because _scheduledFunc is not part of the official type
		if (mockTask && (mockTask as any)._scheduledFunc) {
			await (mockTask as any)._scheduledFunc();
		} else {
			throw new Error("Scheduled function not captured for dynamic source.");
		}

		// Verify that the source's fetch method was called
		expect(dynamicSource.fetch).toHaveBeenCalledTimes(1);

		// Verify that the message broker's publish method was called
		expect(mockMessageBroker.publish).toHaveBeenCalledWith("signals", "", {
			name: "mockSignal",
			timestamp: expect.any(Date),
			value: 123,
			source: "dynamic_source_1",
		});
	});
});
