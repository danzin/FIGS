import { chromium } from "playwright";
import { Scraper, ScraperResult } from "../models/Scraper.interface";
import { IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

export class AppStoreRankScraper implements Scraper {
	public readonly key: string;
	private readonly appId: string;
	private readonly appName: string;
	private readonly storeUrl: string;
	private readonly country: string;

	constructor(appName: string, appId: string, country: string = "us") {
		this.appName = appName.toLowerCase();
		this.appId = appId;
		this.country = country.toLowerCase();
		this.key = `appstore_rank_${this.appName}_ios_${this.country}`;
		this.storeUrl = `https://apps.apple.com/${this.country}/app/${appName}/${appId}`;
	}

	async scrape(): Promise<IndicatorDataPoint | null> {
		console.log(`[AppStoreRankScraper] Scraping ${this.appName}…`);

		const browser = await chromium.launch({
			headless: false,
			slowMo: 100,
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-blink-features=AutomationControlled",
				"--disable-features=VizDisplayCompositor",
				"--disable-web-security",
				"--disable-dev-shm-usage",
				"--no-first-run",
				"--no-default-browser-check",
				"--disable-extensions",
				"--disable-gpu",
				"--disable-dev-shm-usage",
				"--disable-ipc-flooding-protection",
			],
		});

		const context = await browser.newContext({
			userAgent:
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			viewport: { width: 1920, height: 1080 },
			locale: "en-US",
			extraHTTPHeaders: {
				"Accept-Language": "en-US,en;q=0.9",
				Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
				"Accept-Encoding": "gzip, deflate, br",
				DNT: "1",
				Connection: "keep-alive",
				"Upgrade-Insecure-Requests": "1",
			},
		});

		const page = await context.newPage();

		// Add script to remove webdriver detection
		await page.addInitScript(() => {
			// Remove webdriver property
			Object.defineProperty(navigator, "webdriver", {
				get: () => undefined,
			});

			// Mock languages and plugins to appear more human
			Object.defineProperty(navigator, "languages", {
				get: () => ["en-US", "en"],
			});

			Object.defineProperty(navigator, "plugins", {
				get: () => [1, 2, 3, 4, 5], // Mock some plugins
			});

			// Remove chrome automation indicators
			try {
				// Use bracket notation to avoid TypeScript read-only error
				(navigator as any)["webdriver"] = undefined;
			} catch (e) {
				// Ignore if property can't be deleted
			}

			// Override other automation detection methods
			Object.defineProperty(window, "chrome", {
				get: () => ({
					runtime: {},
					// Add other chrome properties as needed
				}),
			});

			// Mock permissions
			const origQuery = navigator.permissions.query.bind(navigator.permissions);
			(navigator.permissions as any).query = (parameters: PermissionDescriptor) => {
				if (parameters.name === "notifications") {
					// Cast our minimal object to satisfy the PermissionStatus interface
					const fakeStatus = { state: Notification.permission } as PermissionStatus;
					return Promise.resolve(fakeStatus);
				}
				return origQuery(parameters);
			};
		});

		try {
			await page.goto(this.storeUrl, {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});

			// Wait for the page to load and look for the rank link
			await page.waitForSelector("a.inline-list__item[data-we-link-to-exclude]", { timeout: 30000 });

			// Add a small delay to appear more human-like
			await page.waitForTimeout(1000);

			// Extract the rank from the "#X in Finance" link
			const rank = await page.evaluate(() => {
				const rankLinks = Array.from(document.querySelectorAll("a.inline-list__item[data-we-link-to-exclude]"));

				for (const link of rankLinks) {
					const text = link.textContent?.trim();
					if (text && text.includes("in Finance")) {
						// Extract the number from "#5 in Finance"
						const match = text.match(/#(\d+)\s+in\s+Finance/i);
						if (match) {
							return parseInt(match[1], 10);
						}
					}
				}

				return null;
			});

			if (rank === null) {
				console.warn(
					`[AppStoreRankScraper] Could not find rank for "${this.appName}". It may not be in the top chart.`
				);
				// Taking a screenshot can be invaluable for debugging why a scrape failed
				await page.screenshot({
					path: `debug_not_found_${this.appName}.png`,
					fullPage: true,
				});
				return null;
			}

			console.log(`[AppStoreRankScraper] Found rank for "${this.appName}": #${rank}`);

			const indicator: IndicatorDataPoint = {
				name: this.key, // Use the unique key as the indicator name
				time: new Date(),
				value: rank,
				source: `AppleAppStore-${this.country.toUpperCase()}`,
			};

			return indicator;
		} catch (error) {
			console.error(`[AppStoreRankScraper] An error occurred while scraping "${this.appName}":`, error);
			// Re-throw the error so the scheduler knows the task failed
			throw error;
		} finally {
			if (browser) {
				await browser.close();
			}
		}
	}
}
