import { useEffect, useRef, useState, useCallback } from "react";

interface WebSocketMessage {
	type: string;
	data: unknown;
	timestamp: string;
}

interface UseWebSocketOptions {
	url?: string;
	onMessage?: (message: WebSocketMessage) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
	onError?: (error: Event) => void;
	enabled?: boolean;
}

interface UseWebSocketReturn {
	isConnected: boolean;
	lastMessage: WebSocketMessage | null;
	subscribe: (channel: string) => void;
	unsubscribe: (channel: string) => void;
}

/**
 * WebSocket hook for real-time updates
 * Falls back gracefully if WebSocket is not available
 */
export const useWebSocket = ({
	url = "/api/ws",
	onMessage,
	onConnect,
	onDisconnect,
	onError,
	enabled = true,
}: UseWebSocketOptions): UseWebSocketReturn => {
	const [isConnected, setIsConnected] = useState(false);
	const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

	const wsRef = useRef<WebSocket | null>(null);
	const subscribedChannelsRef = useRef<Set<string>>(new Set());
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectAttemptsRef = useRef(0);
	const maxReconnectAttempts = 5;

	const connect = useCallback(() => {
		if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) return;

		try {
			// Construct WebSocket URL
			const wsUrl = url.startsWith("ws")
				? url
				: `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${url}`;

			wsRef.current = new WebSocket(wsUrl);

			wsRef.current.onopen = () => {
				console.log("[WebSocket] Connected");
				setIsConnected(true);
				reconnectAttemptsRef.current = 0;
				onConnect?.();

				// Re-subscribe to channels after reconnection
				subscribedChannelsRef.current.forEach((channel) => {
					wsRef.current?.send(JSON.stringify({ type: "subscribe", channel }));
				});
			};

			wsRef.current.onclose = () => {
				console.log("[WebSocket] Disconnected");
				setIsConnected(false);
				onDisconnect?.();

				// Attempt reconnection with backoff
				if (reconnectAttemptsRef.current < maxReconnectAttempts && enabled) {
					reconnectAttemptsRef.current += 1;
					const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
					console.log(`[WebSocket] Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current})`);
					reconnectTimeoutRef.current = setTimeout(connect, delay);
				}
			};

			wsRef.current.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data) as WebSocketMessage;
					setLastMessage(message);
					onMessage?.(message);
				} catch (error) {
					console.error("[WebSocket] Failed to parse message:", error);
				}
			};

			wsRef.current.onerror = (error) => {
				console.error("[WebSocket] Error:", error);
				onError?.(error);
			};
		} catch (error) {
			console.warn("[WebSocket] Connection failed, will retry:", error);
		}
	}, [url, enabled, onConnect, onDisconnect, onMessage, onError]);

	const disconnect = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
		}
		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}
		setIsConnected(false);
	}, []);

	const subscribe = useCallback((channel: string) => {
		subscribedChannelsRef.current.add(channel);
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type: "subscribe", channel }));
		}
	}, []);

	const unsubscribe = useCallback((channel: string) => {
		subscribedChannelsRef.current.delete(channel);
		if (wsRef.current?.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify({ type: "unsubscribe", channel }));
		}
	}, []);

	useEffect(() => {
		if (enabled) {
			// Small delay before connecting to avoid immediate connection attempts
			const timeout = setTimeout(connect, 1000);
			return () => {
				clearTimeout(timeout);
				disconnect();
			};
		}
		return disconnect;
	}, [enabled, connect, disconnect]);

	return {
		isConnected,
		lastMessage,
		subscribe,
		unsubscribe,
	};
};
