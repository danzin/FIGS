import React, { useState, useEffect } from 'react';
import { FinancialChart } from '../components/Chart/FinancialChart';
import { getOhlcData } from '../api/signalsApi';
import type { OhlcData } from '../types/OhlcData';
import type { Interval } from '../types/Interval';

const supportedAssets = [
    { label: 'Bitcoin', value: 'coingecko_bitcoin' },
    { label: 'Ethereum', value: 'coingecko_ethereum' },
    { label: 'Solana', value: 'coingecko_solana' },
];

const supportedIntervals: {label: string, value: Interval}[] = [
    { label: '15 Minutes', value: '15m' },
    { label: '30 Minutes', value: '30m' },
    { label: '1 Hour', value: '1h' },
] ;

export const DashboardPage: React.FC = () => {
    const [selectedAsset, setSelectedAsset] = useState(supportedAssets[0].value);
    const [interval, setInterval] = useState<Interval>(supportedIntervals[2].value); //Defatuls is 1h
    const [chartData, setChartData] = useState<OhlcData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchChartData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await getOhlcData(selectedAsset, interval);
                setChartData(data);
            } catch (err) {
                console.error("Failed to fetch chart data:", err);
                setError("Failed to load chart data. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchChartData();
    }, [selectedAsset, interval]); // Refetch data when selectedAsset changes

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
                <label htmlFor="interval-select">Interval:</label>
            <select
                id="interval-select"
                value={interval}
                onChange={(e) => setInterval(e.target.value as Interval)}
            >
                {supportedIntervals.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
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