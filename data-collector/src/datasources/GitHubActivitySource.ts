import axios from "axios";
import { DataSource, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";

/**
 * Fetches developer activity from GitHub API
 * Goes directly to the source - not relying on 3rd party crypto APIs
 *
 * Tracks commits to core blockchain repos in the last 7 days
 *
 */

interface RepoConfig {
	owner: string;
	repo: string;
	indicatorName: string;
}

// Core blockchain repositories to track (multiple repos per protocol for accurate metrics)
// Bitcoin: Core client + BIPs (improvement proposals)
// Ethereum: Geth + consensus specs + Solidity + EIPs + dev tools
// Solana: Agave validator (moved from solana-labs) + Program library
const CORE_REPOS: RepoConfig[] = [
	// Bitcoin ecosystem
	{ owner: "bitcoin", repo: "bitcoin", indicatorName: "btc_dev_activity" },
	{ owner: "bitcoin", repo: "bips", indicatorName: "btc_dev_activity" },
	// Ethereum ecosystem (largest dev community - need comprehensive coverage)
	{ owner: "ethereum", repo: "go-ethereum", indicatorName: "eth_dev_activity" },
	{ owner: "ethereum", repo: "consensus-specs", indicatorName: "eth_dev_activity" },
	{ owner: "ethereum", repo: "solidity", indicatorName: "eth_dev_activity" },
	{ owner: "ethereum", repo: "EIPs", indicatorName: "eth_dev_activity" },
	{ owner: "ethereum", repo: "remix-project", indicatorName: "eth_dev_activity" },
	// Solana ecosystem (now at anza-xyz/agave after the fork)
	{ owner: "anza-xyz", repo: "agave", indicatorName: "sol_dev_activity" },
	{ owner: "solana-labs", repo: "solana-program-library", indicatorName: "sol_dev_activity" },
	// Other protocols
	{ owner: "ava-labs", repo: "avalanchego", indicatorName: "avax_dev_activity" },
	{ owner: "paritytech", repo: "polkadot-sdk", indicatorName: "dot_dev_activity" },
	{ owner: "cosmos", repo: "cosmos-sdk", indicatorName: "atom_dev_activity" },
	{ owner: "smartcontractkit", repo: "chainlink", indicatorName: "link_dev_activity" },
];

export class GitHubActivitySource implements DataSource {
	public readonly key: string;
	private readonly repos: RepoConfig[];
	private readonly token?: string;
	private readonly baseUrl = "https://api.github.com";

	/**
	 * @param repos - Array of repos to track, or undefined to use defaults
	 * @param token - GitHub personal access token (optional, increases rate limit)
	 */
	constructor(repos?: RepoConfig[], token?: string) {
		this.repos = repos || CORE_REPOS;
		this.token = token;
		this.key = "github_dev_activity";
	}

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		const now = new Date();
		const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

		const headers: Record<string, string> = {
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "FIGS-Data-Collector",
		};

		if (this.token) {
			headers.Authorization = `Bearer ${this.token}`;
		}

		// Aggregate commits and contributors per indicator (protocol)
		const aggregatedCommits = new Map<string, number>();
		const aggregatedContributors = new Map<string, Set<string>>();

		for (const repo of this.repos) {
			try {
				// Fetch commits from the last 7 days
				const response = await axios.get(`${this.baseUrl}/repos/${repo.owner}/${repo.repo}/commits`, {
					headers,
					params: {
						since: sevenDaysAgo.toISOString(),
						per_page: 100,
					},
				});

				const commitCount = response.data?.length || 0;

				// Extract unique contributors
				const authors = response.data
					?.map((commit: { author?: { login?: string } }) => commit.author?.login)
					.filter(Boolean) as string[];

				// Aggregate by indicator name (protocol)
				const currentCommits = aggregatedCommits.get(repo.indicatorName) || 0;
				aggregatedCommits.set(repo.indicatorName, currentCommits + commitCount);

				// Aggregate unique contributors
				if (!aggregatedContributors.has(repo.indicatorName)) {
					aggregatedContributors.set(repo.indicatorName, new Set());
				}
				authors.forEach((author) => aggregatedContributors.get(repo.indicatorName)!.add(author));

				console.log(
					`[GitHubActivitySource] ${repo.owner}/${repo.repo}: ${commitCount} commits, ${authors.length} contributors (7d)`
				);

				// Small delay to respect rate limits
				await this.delay(200);
			} catch (error) {
				console.error(`[GitHubActivitySource] Error fetching ${repo.owner}/${repo.repo}:`, error);

				if (axios.isAxiosError(error)) {
					if (error.response?.status === 403) {
						const rateLimitReset = error.response.headers["x-ratelimit-reset"];
						console.warn(`[GitHubActivitySource] Rate limited. Reset at: ${new Date(Number(rateLimitReset) * 1000)}`);
						// Don't throw - continue with other repos
					}
				}
			}
		}

		// Convert aggregated data to results
		const results: IndicatorDataPoint[] = [];

		for (const [indicatorName, commitCount] of aggregatedCommits) {
			results.push({
				name: indicatorName,
				time: now,
				value: commitCount,
				source: "GitHub",
			});

			const contributors = aggregatedContributors.get(indicatorName);
			results.push({
				name: `${indicatorName}_contributors`,
				time: now,
				value: contributors?.size || 0,
				source: "GitHub",
			});

			console.log(
				`[GitHubActivitySource] ${indicatorName}: TOTAL ${commitCount} commits, ${contributors?.size || 0} unique contributors (7d)`
			);
		}

		// Calculate total ecosystem activity
		const totalCommits = Array.from(aggregatedCommits.values()).reduce((sum, v) => sum + v, 0);
		const totalContributors = new Set(Array.from(aggregatedContributors.values()).flatMap((s) => Array.from(s))).size;

		results.push({
			name: "crypto_total_dev_activity",
			time: now,
			value: totalCommits,
			source: "GitHub",
		});

		results.push({
			name: "crypto_total_contributors",
			time: now,
			value: totalContributors,
			source: "GitHub",
		});

		console.log(`[GitHubActivitySource] Total ecosystem: ${totalCommits} commits, ${totalContributors} contributors`);

		return results.length > 0 ? results : null;
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

/**
 * Simplified source for a single repo
 */
export class SingleRepoActivitySource implements DataSource {
	public readonly key: string;
	private readonly owner: string;
	private readonly repo: string;
	private readonly indicatorName: string;
	private readonly token?: string;
	private readonly baseUrl = "https://api.github.com";

	constructor(owner: string, repo: string, indicatorName: string, token?: string) {
		this.owner = owner;
		this.repo = repo;
		this.indicatorName = indicatorName;
		this.token = token;
		this.key = `github_${indicatorName}`;
	}

	async fetch(): Promise<IndicatorDataPoint[] | null> {
		const now = new Date();
		const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

		const headers: Record<string, string> = {
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "FIGS-Data-Collector",
		};

		if (this.token) {
			headers.Authorization = `Bearer ${this.token}`;
		}

		try {
			const response = await axios.get(`${this.baseUrl}/repos/${this.owner}/${this.repo}/commits`, {
				headers,
				params: {
					since: sevenDaysAgo.toISOString(),
					per_page: 100,
				},
			});

			const commitCount = response.data?.length || 0;

			console.log(`[SingleRepoActivitySource] ${this.owner}/${this.repo}: ${commitCount} commits (7d)`);

			return [
				{
					name: this.indicatorName,
					time: now,
					value: commitCount,
					source: "GitHub",
				},
			];
		} catch (error) {
			console.error(`[SingleRepoActivitySource] Error fetching ${this.owner}/${this.repo}:`, error);
			throw error;
		}
	}
}
