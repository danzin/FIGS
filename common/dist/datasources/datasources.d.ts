import { DataSourceResult } from "../models/data";
export interface DataSource {
    key: string;
    fetch(): Promise<DataSourceResult | null>;
}
//# sourceMappingURL=datasources.d.ts.map