// import { Type } from 'class-transformer';
// import {
//   IsArray,
//   IsDate,
//   IsNotEmpty,
//   IsNumber,
//   IsOptional,
//   IsString,
//   Max,
//   Min,
//   ValidateNested,
// } from 'class-validator';
// import { GetSignalsQueryDto } from './signal.dto';
// export class CorrelationQueryDto {
//   @IsArray()
//   @IsString({ each: true })
//   signals: string[];

//   @IsOptional()
//   @IsString()
//   timeframe?: string; // '1d', '7d', '30d'

//   @IsOptional()
//   @IsString()
//   correlationType?: 'pearson' | 'spearman';
// }

// export class BulkSignalsDto {
//   @IsArray()
//   @IsString({ each: true })
//   signalNames: string[];

//   // Reuse your existing query parameters
//   @ValidateNested()
//   @Type(() => GetSignalsQueryDto)
//   queryParams: GetSignalsQueryDto;
// }
