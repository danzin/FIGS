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
exports.SignalsRepository = void 0;
const common_1 = require("@nestjs/common");
const pg_1 = require("pg");
const database_constants_1 = require("../database/database.constants");
let SignalsRepository = class SignalsRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async findOhlcData(asset, params) {
        const { interval = '1h', source = null, limit = 1000 } = params;
        const text = `SELECT * FROM public.get_ohlc_data($1, $2, $3, $4);`;
        const values = [asset, source, interval, limit];
        try {
            const result = await this.pool.query(text, values);
            return result.rows;
        }
        catch (error) {
            if (error.message.includes('Invalid interval') ||
                error.message.includes('Limit must be')) {
                throw new common_1.BadRequestException(error.message);
            }
            throw error;
        }
    }
    async findLatestPrice(asset) {
        const text = `SELECT * as name, time, price as value, source FROM public.latest_prices WHERE asset = $1;`;
        const result = await this.pool.query(text, [asset]);
        return result.rows[0] || null;
    }
    async findLatestGeneralSignals() {
        const text = `SELECT name, time, value, source FROM public.latest_signals;`;
        const result = await this.pool.query(text);
        return result.rows;
    }
    async findGeneralHourly(signalName, limit = 100) {
        const text = `
      SELECT bucketed_at, name, source, avg_value, min_value, max_value, sample_count
      FROM public.signals_hourly_general
      WHERE name = $1
      ORDER BY bucketed_at DESC
      LIMIT $2;
    `;
        const result = await this.pool.query(text, [signalName, limit]);
        return result.rows;
    }
    async listAssetNames() {
        const text = `SELECT DISTINCT asset FROM public.signals_hourly_ohlc ORDER BY asset;`;
        const result = await this.pool.query(text);
        return result.rows.map((r) => r.asset);
    }
    async listGeneralSignalNames() {
        const text = `SELECT DISTINCT name FROM public.signals_hourly_general ORDER BY name;`;
        const result = await this.pool.query(text);
        return result.rows.map((r) => r.name);
    }
    async findLatestSignalsByNames(signalNames) {
        if (!signalNames || signalNames.length === 0) {
            return [];
        }
        const text = `
      SELECT name, time, value, source
      FROM public.latest_signals
      WHERE name = ANY($1::text[]);
    `;
        try {
            const result = await this.pool.query(text, [signalNames]);
            return result.rows;
        }
        catch (error) {
            console.error(`[SignalsRepository] Error fetching latest signals by names:`, error);
            throw error;
        }
    }
    async findLatestPricesByNames(priceNames) {
        if (!priceNames || priceNames.length === 0) {
            return [];
        }
        const text = `
      SELECT asset, time, price, source
      FROM public.latest_prices
      WHERE asset = ANY($1::text[]);
    `;
        try {
            const result = await this.pool.query(text, [priceNames]);
            return result.rows;
        }
        catch (error) {
            console.error(`[SignalsRepository] Error fetching latest prices by names:`, error);
            throw error;
        }
    }
};
exports.SignalsRepository = SignalsRepository;
exports.SignalsRepository = SignalsRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_constants_1.PG_CONNECTION)),
    __metadata("design:paramtypes", [pg_1.Pool])
], SignalsRepository);
//# sourceMappingURL=signals.repository.js.map