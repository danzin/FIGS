import { chromium, Page } from "playwright";
import { Scraper } from "../models/Scraper.interface";
import { IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

export class AppStoreRankScraper implements Scraper {
	public readonly key: string;
	private readonly appName: string;
	private readonly appDisplayName: string;
	private readonly chartsUrl: string;
	private readonly country: string;

	constructor(appName: string, appDisplayName: string, country: string = "us") {
		this.appName = appName.toLowerCase();
		this.appDisplayName = appDisplayName;
		this.country = country.toLowerCase();
		this.key = `Coinbase_Rank`;

		this.chartsUrl = `https://apps.apple.com/us/charts/iphone/finance-apps/6015?chart=top-free`;
	}

	private async addStealthScripts(page: Page): Promise<void> {
		await page.addInitScript(() => {
			// remove webdriver property to avoid detection
			Object.defineProperty(navigator, "webdriver", {
				get: () => undefined,
				configurable: true,
			});

			// Override the plugins property to appear more realistic
			// Real browsers have actual plugin objects, not just arrays
			Object.defineProperty(navigator, "plugins", {
				get: () => {
					const plugins = [
						{ name: "Chrome PDF Plugin", description: "Portable Document Format" },
						{ name: "Chrome PDF Viewer", description: "PDF Viewer" },
						{ name: "Native Client", description: "Native Client Executable" },
					];
					return plugins;
				},
			});

			// Mock realistic language preferences
			Object.defineProperty(navigator, "languages", {
				get: () => ["en-US", "en"],
			});

			// Override permissions API to avoid automation detection
			const originalQuery = navigator.permissions.query.bind(navigator.permissions);
			navigator.permissions.query = (params: any) => {
				// Return realistic permission states instead of automation defaults
				const fakeResult = { state: "denied" } as PermissionStatus;
				return Promise.resolve(fakeResult);
			};

			// Remove chrome automation indicators and add realistic chrome object
			Object.defineProperty(window, "chrome", {
				get: () => ({
					runtime: {
						onConnect: undefined,
						onMessage: undefined,
					},
					app: {
						isInstalled: false,
					},
				}),
			});

			// Deny notification permission to appear natural
			Object.defineProperty(Notification, "permission", {
				get: () => "denied",
			});

			// Hide automation-specific properties that might leak
			delete (window as any).__playwright;
			delete (window as any).__pw_manual;
			delete (window as any).__PW_inspect;

			// Mock realistic connection properties
			Object.defineProperty(navigator, "connection", {
				get: () => ({
					effectiveType: "4g",
					rtt: 50,
					downlink: 10,
				}),
			});

			// Override toString methods that might reveal automation
			const originalToString = Function.prototype.toString;
			Function.prototype.toString = function () {
				if (this === navigator.permissions.query) {
					return "function query() { [native code] }";
				}
				return originalToString.call(this);
			};
		});
	}

	private getRandomUserAgent(): string {
		// Rrotate between a few common user agents to avoid detection
		const userAgents = [
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
		];
		return userAgents[Math.floor(Math.random() * userAgents.length)];
	}

	private async createStealthContext() {
		// Launch browser with comprehensive stealth flags
		// Each flag serves a specific purpose in avoiding detection
		const browser = await chromium.launch({
			headless: true, // TODO: Set to true in production
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-blink-features=AutomationControlled", // Critical: removes automation indicators
				"--disable-features=VizDisplayCompositor",
				"--disable-web-security",
				"--disable-dev-shm-usage",
				"--no-first-run",
				"--no-default-browser-check",
				"--disable-extensions",
				"--disable-gpu",
				"--disable-ipc-flooding-protection",
				"--disable-background-networking",
				"--disable-background-timer-throttling",
				"--disable-backgrounding-occluded-windows",
				"--disable-breakpad",
				"--disable-client-side-phishing-detection",
				"--disable-component-update",
				"--disable-default-apps",
				"--disable-domain-reliability",
				"--disable-features=TranslateUI",
				"--disable-hang-monitor",
				"--disable-prompt-on-repost",
				"--disable-sync",
				"--metrics-recording-only",
				"--no-crash-upload",
				"--no-report-upload",
			],
		});

		// Create context with realistic browser characteristics
		const context = await browser.newContext({
			userAgent: this.getRandomUserAgent(),
			viewport: {
				width: 1366 + Math.floor(Math.random() * 200), // Slight randomization
				height: 768 + Math.floor(Math.random() * 200),
			},
			locale: "en-US",
			timezoneId: "America/New_York",
			extraHTTPHeaders: {
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
				"Accept-Language": "en-US,en;q=0.9",
				"Accept-Encoding": "gzip, deflate, br",
				DNT: "1",
				Connection: "keep-alive",
				"Upgrade-Insecure-Requests": "1",
				"Sec-Fetch-Site": "none",
				"Sec-Fetch-Mode": "navigate",
				"Sec-Fetch-User": "?1",
				"Sec-Fetch-Dest": "document",
				"Cache-Control": "max-age=0",
			},
		});

		return { browser, context };
	}

	private async humanLikeDelay(min: number = 100, max: number = 300): Promise<void> {
		// Random delays to simulate human behavior patterns
		const delay = Math.floor(Math.random() * (max - min + 1)) + min;
		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	async fetch(): Promise<IndicatorDataPoint | null> {
		console.log(`[AppStoreRankScraper] Scraping ${this.appName} from charts page…`);

		const { browser, context } = await this.createStealthContext();
		const page = await context.newPage();

		try {
			// Apply stealth scripts before navigation
			await this.addStealthScripts(page);

			await page.goto(this.chartsUrl, {
				waitUntil: "domcontentloaded",
				timeout: 60000,
			});

			// Wait for the charts content to load
			await this.humanLikeDelay(1000, 2000);

			// Wait for the lockup elements to present
			await page.waitForSelector(".we-lockup", { timeout: 30000 });

			// Extract rank by searching through all app entries
			const rank = await page.evaluate((searchAppName) => {
				// Get all app lockup elements (each represents one app in the charts)
				const lockupElements = Array.from(document.querySelectorAll(".we-lockup"));

				for (const lockup of lockupElements) {
					// Get the app title from the lockup
					const titleElement = lockup.querySelector(".we-lockup__title .we-clamp");
					const title = titleElement?.textContent?.trim() || "";

					// Check if this is the app we're looking for
					// Using case-insensitive partial match to handle variations in naming
					if (title.toLowerCase().includes(searchAppName.toLowerCase())) {
						// Get the rank from the same lockup element
						const rankElement = lockup.querySelector(".we-lockup__rank");
						const rankText = rankElement?.textContent?.trim();
						console.log(`Found app: "${title}" with rank text: "${rankText}"`);
						if (rankText) {
							const rankNumber = parseInt(rankText, 10);
							if (!isNaN(rankNumber)) {
								return rankNumber;
							}
						}
					}
				}

				return null;
			}, this.appDisplayName);

			let finalRank: number | null; // Use a variable to hold the final value

			if (rank === null) {
				console.warn(
					`[AppStoreRankScraper] Could not find "${this.appDisplayName}" in AppStore Finance charts. Coinbase is NOT in the Top 100!.`
				);

				finalRank = null;
			} else {
				console.log(`[AppStoreRankScraper] Found "${this.appDisplayName}" at rank #${rank} AppStore Finance charts`);
				finalRank = rank;
			}

			console.log(`[AppStoreRankScraper] Found "${this.appDisplayName}" at rank #${rank} in AppStore Finance charts`);

			// Return structured data point
			const indicator: IndicatorDataPoint = {
				name: this.key,
				time: new Date(),
				value: finalRank, // The value can be a number or null
				source: `AppleAppStore-${this.country.toUpperCase()}`,
			};

			return indicator;
		} catch (error) {
			console.error(`[AppStoreRankScraper] Error scraping "${this.appName}":`, error);
			throw error;
		} finally {
			if (browser) {
				await browser.close();
			}
		}
	}
}
