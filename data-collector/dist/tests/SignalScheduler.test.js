"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const SignalScheduler_1 = require("../SignalScheduler");
// Mock node-cron
jest.mock("node-cron", () => ({
    schedule: jest.fn().mockImplementation((cronExpression, func, options) => {
        // Mock the task object
        const mockTask = {
            start: jest.fn(() => { }),
            stop: jest.fn(),
        };
        // Store the scheduled function to potentially call it manually if needed
        mockTask.start._scheduledFunc = func;
        return mockTask;
    }),
}));
// Mock DataSource
class MockDataSource {
    constructor(key) {
        this.key = key;
        // Initialize fetch here after this.key is set
        this.fetch = jest.fn().mockResolvedValue({
            name: "mockSignal",
            timestamp: new Date(),
            value: 123,
            source: this.key,
        });
    }
}
// Mock MessageBroker
const mockMessageBroker = {
    publish: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue("consumerTag"),
    close: jest.fn().mockResolvedValue(undefined),
};
describe("SignalScheduler Dynamic Registration", () => {
    let scheduler;
    let mockTask; // To hold the reference to the mocked task
    beforeEach(() => {
        jest.clearAllMocks();
        scheduler = new SignalScheduler_1.SignalScheduler(mockMessageBroker);
        // Capture the mock task created by cron.schedule
        node_cron_1.default.schedule.mockImplementation((cronExpression, func, options) => {
            mockTask = {
                start: jest.fn(() => {
                    // Store the function to be called
                    mockTask._scheduledFunc = func;
                }),
                stop: jest.fn(),
            };
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
        const dynamicConfig = {
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
        expect(node_cron_1.default.schedule).toHaveBeenCalledTimes(2);
        expect(node_cron_1.default.schedule).toHaveBeenCalledWith(dynamicConfig.schedule, expect.any(Function), {
            scheduled: false,
            timezone: "UTC",
        });
        // Verify that the task for the dynamic source was started
        expect(mockTask.start).toHaveBeenCalledTimes(1);
        // Simulate the cron job execution for the dynamic source
        // by directly calling the function passed to cron.schedule
        if (mockTask && mockTask._scheduledFunc) {
            await mockTask._scheduledFunc();
        }
        else {
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
//# sourceMappingURL=SignalScheduler.test.js.map