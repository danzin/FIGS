import React, { useState, useEffect } from 'react';
import { FinancialChart } from '../components/Chart/FinancialChart';
import { getOhlcData } from '../api/signalsApi';
import type { OhlcData } from '../types/OhlcData';

const supportedAssets = [
    { label: 'Bitcoin', value: 'coingecko_bitcoin' },
    { label: 'Ethereum', value: 'coingecko_ethereum' },
    { label: 'Solana', value: 'coingecko_solana' },
];

export const DashboardPage: React.FC = () => {
    const [selectedAsset, setSelectedAsset] = useState(supportedAssets[0].value);
    const [chartData, setChartData] = useState<OhlcData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchChartData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getOhlcData(selectedAsset, '1 hour');
                setChartData(data);
            } catch (err) {
                console.error("Failed to fetch chart data:", err);
                setError("Failed to load chart data. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchChartData();
    }, [selectedAsset]); // Refetch data when selectedAsset changes

    return (
        <div>
            <h1>Financial Signals Dashboard</h1>
            
            <div style={{ marginBottom: '20px' }}>
                <label htmlFor="asset-select">Select Asset: </label>
                <select 
                    id="asset-select"
                    value={selectedAsset}
                    onChange={(e) => setSelectedAsset(e.target.value)}
                >
                    {supportedAssets.map(asset => (
                        <option key={asset.value} value={asset.value}>
                            {asset.label}
                        </option>
                    ))}
                </select>
            </div>

            {isLoading && <p>Loading chart...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {!isLoading && !error && (
                <FinancialChart data={chartData} />
            )}
        </div>
    );
};