import assert from "node:assert/strict";
import Parser from "rss-parser";
import { Errors, isAppError } from "@financialsignalsgatheringsystem/common";
import { CoinDeskSource } from "../scrapers/CoinDesk";
import { EnergyChokepointSource } from "../scrapers/EnergyChokepointSource";
import { toServiceError } from "../utils/errors";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

async function withPatchedParseUrl(
  implementation: typeof Parser.prototype.parseURL,
  run: () => Promise<void>,
): Promise<void> {
  const originalParseUrl = Parser.prototype.parseURL;
  Parser.prototype.parseURL = implementation;

  try {
    await run();
  } finally {
    Parser.prototype.parseURL = originalParseUrl;
  }
}

const tests: TestCase[] = [
  {
    name: "toServiceError wraps unknown failures with context",
    run: () => {
      const error = toServiceError(
        new Error("rss unavailable"),
        {
          operation: "fetch",
          service: "scraper-service",
          scraper: "test-source",
        },
        "Failed to fetch test feed.",
      );

      assert.equal(isAppError(error), true);
      assert.equal(error.message, "Failed to fetch test feed.");
      assert.equal(error.context?.service, "scraper-service");
      assert.equal(error.context?.scraper, "test-source");
      assert.ok(error.cause instanceof Error);
    },
  },
  {
    name: "toServiceError preserves existing AppError instances",
    run: () => {
      const existing = Errors.validation("existing app error", {
        context: {
          operation: "fetch",
          service: "scraper-service",
        },
      });

      const result = toServiceError(existing, {
        operation: "ignored",
        service: "ignored",
      });

      assert.equal(result, existing);
    },
  },
  {
    name: "CoinDeskSource converts parser failures into AppError",
    run: async () => {
      await withPatchedParseUrl(
        (async () => {
          throw new Error("parser offline");
        }) as typeof Parser.prototype.parseURL,
        async () => {
          const source = new CoinDeskSource();

          await assert.rejects(source.fetch(), (error: unknown) => {
            assert.equal(isAppError(error), true);
            if (!isAppError(error)) {
              return false;
            }

            assert.equal(error.message, "Failed to fetch CoinDesk RSS feed.");
            assert.equal(error.context?.service, "scraper-service");
            assert.equal(error.context?.scraper, source.key);
            return true;
          });
        },
      );
    },
  },
  {
    name: "EnergyChokepointSource converts parser failures into AppError",
    run: async () => {
      await withPatchedParseUrl(
        (async () => {
          throw new Error("google news unavailable");
        }) as typeof Parser.prototype.parseURL,
        async () => {
          const source = new EnergyChokepointSource();

          await assert.rejects(source.fetch(), (error: unknown) => {
            assert.equal(isAppError(error), true);
            if (!isAppError(error)) {
              return false;
            }

            assert.equal(
              error.message,
              "Failed to fetch energy chokepoint news feed.",
            );
            assert.equal(error.context?.service, "scraper-service");
            assert.equal(error.context?.scraper, source.key);
            return true;
          });
        },
      );
    },
  },
];

async function run(): Promise<void> {
  console.log(`Running ${tests.length} scraper-service core tests...`);
  for (const test of tests) {
    try {
      await test.run();
      console.log(`✓ ${test.name}`);
    } catch (error) {
      console.error(`✗ ${test.name}`);
      throw error;
    }
  }
  console.log("All scraper-service core tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
