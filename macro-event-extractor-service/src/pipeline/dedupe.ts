export class RecentHashDedupe {
	private readonly capacity: number;
	private readonly seen = new Set<string>();
	private readonly order: string[] = [];

	constructor(capacity = 5000) {
		this.capacity = capacity;
	}

	public has(hash: string): boolean {
		return this.seen.has(hash);
	}

	public remember(hash: string): void {
		if (this.seen.has(hash)) return;

		this.seen.add(hash);
		this.order.push(hash);

		while (this.order.length > this.capacity) {
			const oldest = this.order.shift();
			if (oldest) this.seen.delete(oldest);
		}
	}
}

