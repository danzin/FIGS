import { SignalsRepository } from '../repositories/signals.repository';
import { SignalDto, GetOhlcQueryDto, OhlcDataDto, PriceDTO } from '../models/signal.dto';
export declare class SignalsService {
    private readonly repo;
    constructor(repo: SignalsRepository);
    getOhlcData(asset: string, queryParams: GetOhlcQueryDto): Promise<OhlcDataDto[]>;
    getLatestPrice(asset: string): Promise<SignalDto>;
    listAssets(): Promise<string[]>;
    listGeneralSignals(): Promise<string[]>;
    getLatestSignalsByNames(names: string[]): Promise<Record<string, SignalDto>>;
    getLatestPricesByNames(assets: string[]): Promise<Record<string, PriceDTO>>;
}
