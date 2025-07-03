import { DataSource } from "./Datasource";
import { Signal } from "@financialsignalsgatheringsystem/common";
export declare class FredSource implements DataSource {
    key: string;
    private readonly apiKey;
    private readonly series_id;
    constructor(apiKey: string, series_id: string);
    fetch(): Promise<Signal | null>;
}
//# sourceMappingURL=fred.d.ts.map