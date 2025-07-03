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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalsController = void 0;
const common_1 = require("@nestjs/common");
const signals_service_1 = require("./../services/signals.service");
const signal_dto_1 = require("../models/signal.dto");
let SignalsController = class SignalsController {
    signalsService;
    constructor(signalsService) {
        this.signalsService = signalsService;
    }
    async getLatestPrice(queryParams) {
        return this.signalsService.getLatestPricesByNames(queryParams.assets);
    }
    async listGeneralSignals() {
        return this.signalsService.listGeneralSignals();
    }
    async getLatestSignals(queryParams) {
        return this.signalsService.getLatestSignalsByNames(queryParams.names);
    }
    async listAssets() {
        return this.signalsService.listAssets();
    }
    async getOhlc(asset, queryParams) {
        console.log('Received query params:', queryParams);
        return this.signalsService.getOhlcData(asset, queryParams);
    }
};
exports.SignalsController = SignalsController;
__decorate([
    (0, common_1.Get)('assets/latest'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [signal_dto_1.GetLatestPricesQueryDto]),
    __metadata("design:returntype", Promise)
], SignalsController.prototype, "getLatestPrice", null);
__decorate([
    (0, common_1.Get)('signals'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SignalsController.prototype, "listGeneralSignals", null);
__decorate([
    (0, common_1.Get)('signals/latest'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [signal_dto_1.GetLatestSignalsQueryDto]),
    __metadata("design:returntype", Promise)
], SignalsController.prototype, "getLatestSignals", null);
__decorate([
    (0, common_1.Get)('assets'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SignalsController.prototype, "listAssets", null);
__decorate([
    (0, common_1.Get)('assets/:asset/ohlc'),
    __param(0, (0, common_1.Param)('asset')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, signal_dto_1.GetOhlcQueryDto]),
    __metadata("design:returntype", Promise)
], SignalsController.prototype, "getOhlc", null);
exports.SignalsController = SignalsController = __decorate([
    (0, common_1.Controller)('v1'),
    __metadata("design:paramtypes", [signals_service_1.SignalsService])
], SignalsController);
//# sourceMappingURL=signals.controller.js.map