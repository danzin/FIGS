"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetLatestPricesQueryDto = exports.GetLatestSignalsQueryDto = exports.GetSignalsQueryDto = exports.VwapDto = exports.OhlcDataDto = exports.GetOhlcQueryDto = exports.OhlcDto = exports.PriceDTO = exports.SignalDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const class_transformer_2 = require("class-transformer");
const VALID_GRANS = [
    '1 minute',
    '5 minutes',
    '15 minutes',
    '1 hour',
    '1 day',
    '1 week',
    '1 month',
];
class SignalDto {
    name;
    time;
    value;
    source;
}
exports.SignalDto = SignalDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SignalDto.prototype, "name", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Date),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], SignalDto.prototype, "time", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], SignalDto.prototype, "value", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SignalDto.prototype, "source", void 0);
class PriceDTO {
    asset;
    time;
    price;
    source;
}
exports.PriceDTO = PriceDTO;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PriceDTO.prototype, "asset", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Date),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], PriceDTO.prototype, "time", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PriceDTO.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PriceDTO.prototype, "source", void 0);
class OhlcDto {
    time;
    name;
    open_price;
    high_price;
    low_price;
    close_price;
    total_volume;
}
exports.OhlcDto = OhlcDto;
class GetOhlcQueryDto {
    interval;
    source;
    limit = 1000;
}
exports.GetOhlcQueryDto = GetOhlcQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['15m', '1h', '30m', '1d']),
    __metadata("design:type", String)
], GetOhlcQueryDto.prototype, "interval", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GetOhlcQueryDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(10000),
    __metadata("design:type", Number)
], GetOhlcQueryDto.prototype, "limit", void 0);
class OhlcDataDto {
    timestamp;
    open;
    high;
    low;
    close;
    volume;
}
exports.OhlcDataDto = OhlcDataDto;
__decorate([
    (0, class_transformer_1.Type)(() => Date),
    (0, class_validator_1.IsDate)(),
    __metadata("design:type", Date)
], OhlcDataDto.prototype, "timestamp", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], OhlcDataDto.prototype, "open", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], OhlcDataDto.prototype, "high", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], OhlcDataDto.prototype, "low", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], OhlcDataDto.prototype, "close", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], OhlcDataDto.prototype, "volume", void 0);
class VwapDto {
    time;
    name;
    vwap;
    total_volume;
}
exports.VwapDto = VwapDto;
class GetSignalsQueryDto {
    startTime;
    endTime;
    limit = 100;
    granularity;
    source;
}
exports.GetSignalsQueryDto = GetSignalsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)({}, { message: 'startTime must be a valid ISO8601 timestamp' }),
    __metadata("design:type", String)
], GetSignalsQueryDto.prototype, "startTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)({}, { message: 'endTime must be a valid ISO8601 timestamp' }),
    __metadata("design:type", String)
], GetSignalsQueryDto.prototype, "endTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(1000),
    __metadata("design:type", Number)
], GetSignalsQueryDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(new RegExp(`^(${VALID_GRANS.join('|')})$`), {
        message: `granularity must be one of ${VALID_GRANS.join(', ')}`,
    }),
    __metadata("design:type", String)
], GetSignalsQueryDto.prototype, "granularity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GetSignalsQueryDto.prototype, "source", void 0);
class GetLatestSignalsQueryDto {
    names;
}
exports.GetLatestSignalsQueryDto = GetLatestSignalsQueryDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_transformer_2.Transform)(({ value }) => typeof value === 'string' ? value.split(',') : value),
    __metadata("design:type", Array)
], GetLatestSignalsQueryDto.prototype, "names", void 0);
class GetLatestPricesQueryDto {
    assets;
}
exports.GetLatestPricesQueryDto = GetLatestPricesQueryDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ArrayUnique)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_transformer_2.Transform)(({ value }) => typeof value === 'string' ? value.split(',') : value),
    __metadata("design:type", Array)
], GetLatestPricesQueryDto.prototype, "assets", void 0);
//# sourceMappingURL=signal.dto.js.map