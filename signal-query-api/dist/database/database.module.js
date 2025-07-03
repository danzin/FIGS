"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const pg_1 = require("pg");
const database_constants_1 = require("./database.constants");
const dbProvider = {
    provide: database_constants_1.PG_CONNECTION,
    inject: [config_1.ConfigService],
    useFactory: async (configService) => {
        const pool = new pg_1.Pool({
            host: configService.get('database.host'),
            port: configService.get('database.port'),
            user: configService.get('database.username'),
            password: configService.get('database.password'),
            database: configService.get('database.name'),
        });
        try {
            const client = await pool.connect();
            console.log('[DatabaseModule] Successfully connected to TimescaleDB.');
            client.release();
        }
        catch (error) {
            console.error('[DatabaseModule] Failed to connect to TimescaleDB:', error);
            throw error;
        }
        return pool;
    },
};
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [dbProvider],
        exports: [dbProvider],
    })
], DatabaseModule);
//# sourceMappingURL=database.module.js.map