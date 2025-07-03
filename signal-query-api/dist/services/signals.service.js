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
exports.SignalsService = void 0;
const common_1 = require("@nestjs/common");
const signals_repository_1 = require("../repositories/signals.repository");
let SignalsService = class SignalsService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async getOhlcData(asset, queryParams) {
        const data = await this.repo.findOhlcData(asset, queryParams);
        if (!data || data.length === 0) {
            throw new common_1.NotFoundException(`No OHLC data found for asset '${asset}' with the given criteria.`);
        }
        return data;
    }
    async getLatestPrice(asset) {
        const latest = await this.repo.findLatestPrice(asset);
        if (!latest) {
            throw new common_1.NotFoundException(`No latest price found for asset '${asset}'`);
        }
        return latest;
    }
    async listAssets() {
        return this.repo.listAssetNames();
    }
    async listGeneralSignals() {
        return this.repo.listGeneralSignalNames();
    }
    async getLatestSignalsByNames(names) {
        const signals = await this.repo.findLatestSignalsByNames(names);
        const signalsMap = {};
        for (const signal of signals) {
            signalsMap[signal.name] = signal;
        }
        for (const requestedName of names) {
            if (!signalsMap[requestedName]) {
                console.warn(`[SignalsService] No latest value found for requested signal: ${requestedName}`);
            }
        }
        return signalsMap;
    }
    async getLatestPricesByNames(assets) {
        const signals = await this.repo.findLatestPricesByNames(assets);
        const signalsMap = {};
        for (const signal of signals) {
            signalsMap[signal.asset] = signal;
        }
        for (const requestedAsset of assets) {
            if (!signalsMap[requestedAsset]) {
                console.warn(`[SignalsService] No latest value found for requested price: ${requestedAsset}`);
            }
        }
        return signalsMap;
    }
};
exports.SignalsService = SignalsService;
exports.SignalsService = SignalsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [signals_repository_1.SignalsRepository])
], SignalsService);
//# sourceMappingURL=signals.service.js.map