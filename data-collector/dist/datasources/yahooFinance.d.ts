import { DataSource } from "./Datasource";
import { Signal } from "@financialsignalsgatheringsystem/common";
export declare class YahooFinanceSource implements DataSource {
    key: string;
    private readonly symbol;
    private readonly metric;
    constructor(symbol: string, metric?: "price" | "volume");
    fetch(): Promise<Signal | null>;
}
export declare class VIXSource extends YahooFinanceSource {
    constructor();
}
export declare class SPYSource extends YahooFinanceSource {
    constructor();
}
export declare class BrentCrudeOilSource implements DataSource {
    key: string;
    private static readonly BRENT_SYMBOLS;
    private sources;
    private currentSourceIndex;
    constructor();
    fetch(): Promise<Signal | null>;
}
//# sourceMappingURL=yahooFinance.d.ts.map