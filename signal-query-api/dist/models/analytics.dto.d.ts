import { GetSignalsQueryDto } from './signal.dto';
export declare class CorrelationQueryDto {
    signals: string[];
    timeframe?: string;
    correlationType?: 'pearson' | 'spearman';
}
export declare class BulkSignalsDto {
    signalNames: string[];
    queryParams: GetSignalsQueryDto;
}
