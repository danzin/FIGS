import { DataSource, MarketDataPoint } from "@financialsignalsgatheringsystem/common";
export declare class CoinGeckoMarketDataSource implements DataSource {
    readonly key: string;
    private readonly coinGeckoId;
    constructor(coinGeckoId: string);
    fetch(): Promise<MarketDataPoint[] | null>;
}
//# sourceMappingURL=CoinGeckoMarketDataSource.d.ts.map