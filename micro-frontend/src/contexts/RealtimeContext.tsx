import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import type { MarketHeartbeatData } from "../types/Indicators";

interface RealtimeData {
	prices: Record<string, { value: number; change: number | null }>;
	marketHeartbeat: MarketHeartbeatData;
	lastUpdate: Date | null;
}

interface RealtimeContextValue {
	data: RealtimeData;
	isConnected: boolean;
	subscribe: (asset: string) => void;
	unsubscribe: (asset: string) => void;
}

const defaultData: RealtimeData = {
	prices: {},
	marketHeartbeat: {},
	lastUpdate: null,
};

const RealtimeContext = createContext<RealtimeContextValue>({
	data: defaultData,
	isConnected: false,
	subscribe: () => {},
	unsubscribe: () => {},
});

interface RealtimeProviderProps {
	children: ReactNode;
	wsUrl?: string;
	enabled?: boolean;
}

export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({
	children,
	wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/ws`,
	enabled = true,
}) => {
	const [data, setData] = useState<RealtimeData>(defaultData);

	const handleMessage = useCallback((message: { type: string; data: unknown }) => {
		switch (message.type) {
			case "price_update": {
				const priceData = message.data as { asset: string; price: number; change: number | null };
				setData((prev) => ({
					...prev,
					prices: {
						...prev.prices,
						[priceData.asset]: { value: priceData.price, change: priceData.change },
					},
					lastUpdate: new Date(),
				}));
				break;
			}
			case "heartbeat_update": {
				const heartbeatData = message.data as MarketHeartbeatData;
				setData((prev) => ({
					...prev,
					marketHeartbeat: { ...prev.marketHeartbeat, ...heartbeatData },
					lastUpdate: new Date(),
				}));
				break;
			}
			case "indicator_update": {
				// Handle indicator updates
				setData((prev) => ({
					...prev,
					lastUpdate: new Date(),
				}));
				break;
			}
		}
	}, []);

	const { isConnected, subscribe, unsubscribe } = useWebSocket({
		url: wsUrl,
		onMessage: handleMessage,
		onConnect: () => {
			console.log("[Realtime] Connected to WebSocket");
			// Subscribe to default channels
			subscribe("prices");
			subscribe("heartbeat");
		},
		enabled,
	});

	const value: RealtimeContextValue = {
		data,
		isConnected,
		subscribe,
		unsubscribe,
	};

	return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => {
	const context = useContext(RealtimeContext);
	if (!context) {
		throw new Error("useRealtime must be used within a RealtimeProvider");
	}
	return context;
};
