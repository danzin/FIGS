import { SignalsService } from './../services/signals.service';
import { GetLatestPricesQueryDto, GetLatestSignalsQueryDto, GetOhlcQueryDto, OhlcDataDto, PriceDTO, SignalDto } from '../models/signal.dto';
export declare class SignalsController {
    private readonly signalsService;
    constructor(signalsService: SignalsService);
    getLatestPrice(queryParams: GetLatestPricesQueryDto): Promise<Record<string, PriceDTO>>;
    listGeneralSignals(): Promise<string[]>;
    getLatestSignals(queryParams: GetLatestSignalsQueryDto): Promise<Record<string, SignalDto>>;
    listAssets(): Promise<string[]>;
    getOhlc(asset: string, queryParams: GetOhlcQueryDto): Promise<OhlcDataDto[]>;
}
