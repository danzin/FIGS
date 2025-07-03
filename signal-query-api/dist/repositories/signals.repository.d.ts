import { Pool } from 'pg';
import { SignalDto, GetOhlcQueryDto, OhlcDataDto, PriceDTO } from '../models/signal.dto';
export declare class SignalsRepository {
    private readonly pool;
    constructor(pool: Pool);
    findOhlcData(asset: string, params: GetOhlcQueryDto): Promise<OhlcDataDto[]>;
    findLatestPrice(asset: string): Promise<SignalDto | null>;
    findLatestGeneralSignals(): Promise<SignalDto[]>;
    findGeneralHourly(signalName: string, limit?: number): Promise<any[]>;
    listAssetNames(): Promise<string[]>;
    listGeneralSignalNames(): Promise<string[]>;
    findLatestSignalsByNames(signalNames: string[]): Promise<SignalDto[]>;
    findLatestPricesByNames(priceNames: string[]): Promise<PriceDTO[]>;
}
