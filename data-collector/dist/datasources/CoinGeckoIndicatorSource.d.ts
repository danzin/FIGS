import { DataSource, IndicatorDataPoint } from "@financialsignalsgatheringsystem/common";
type IndicatorMetric = "btc_dominance" | "btc_volume";
export declare class CoinGeckoIndicatorSource implements DataSource {
    readonly key: string;
    private readonly metric;
    constructor(metric: IndicatorMetric);
    fetch(): Promise<IndicatorDataPoint | null>;
    private fetchBitcoinDominance;
}
export {};
//# sourceMappingURL=CoinGeckoIndicatorSource.d.ts.map