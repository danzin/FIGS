import { YahooFinanceSource } from "./yahooFinance";

export class SPYSource extends YahooFinanceSource {
	constructor() {
		super("SPY", "price");
		this.key = "spy_price";
	}
}
