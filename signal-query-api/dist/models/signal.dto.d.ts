export declare class SignalDto {
    name: string;
    time: Date;
    value: number;
    source: string;
}
export declare class PriceDTO {
    asset: string;
    time: Date;
    price: number;
    source: string;
}
export declare class OhlcDto {
    time: Date;
    name: string;
    open_price: number;
    high_price: number;
    low_price: number;
    close_price: number;
    total_volume: number;
}
export declare class GetOhlcQueryDto {
    interval?: '15m' | '1h' | '30m' | '1d';
    source?: string;
    limit?: number;
}
export declare class OhlcDataDto {
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}
export declare class VwapDto {
    time: Date;
    name: string;
    vwap: number;
    total_volume: number;
}
export declare class GetSignalsQueryDto {
    startTime?: string;
    endTime?: string;
    limit?: number;
    granularity?: string;
    source?: string;
}
export declare class GetLatestSignalsQueryDto {
    names: string[];
}
export declare class GetLatestPricesQueryDto {
    assets: string[];
}
