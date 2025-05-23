import { YahooFinanceSource } from "./yahooFinance";

export class VIXSource extends YahooFinanceSource {
	constructor() {
		super("^VIX", "price");
		this.key = "vix_level";
	}
}
