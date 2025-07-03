export interface MarketDataPoint {
    time: Date;
    asset_symbol: string;
    type: "price" | "volume";
    value: number;
    source: string;
}
//# sourceMappingURL=marketDataPoint.d.ts.map