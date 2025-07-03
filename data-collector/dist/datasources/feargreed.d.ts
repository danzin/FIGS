import { DataSource } from "./Datasource";
import { Signal } from "@financialsignalsgatheringsystem/common";
export declare class FearGreedSource implements DataSource {
    key: string;
    fetch(): Promise<Signal | null>;
}
//# sourceMappingURL=feargreed.d.ts.map