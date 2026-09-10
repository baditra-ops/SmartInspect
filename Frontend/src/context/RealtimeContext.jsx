import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";
import { createSocketClient, WS_EVENTS } from "../services/socket";

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState("DISCONNECTED"); // 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("smartinspect_token");

    if (!user || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setConnectionState("DISCONNECTED");
      return;
    }

    setConnectionState("CONNECTING");
    const socket = createSocketClient(token);
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setConnectionState("CONNECTED");
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
      setConnectionState("DISCONNECTED");
    });

    socket.on("connect_error", (error) => {
      setIsConnected(false);
      setConnectionState("DISCONNECTED");
      if (import.meta.env.DEV) {
        console.warn("[Realtime] Connection error:", error.message);
      }
    });

    // Listen for any broadcast event to update lastEvent
    Object.values(WS_EVENTS).forEach((eventName) => {
      socket.on(eventName, (payload) => {
        setLastEvent({
          event: eventName,
          payload,
          receivedAt: new Date().toISOString(),
        });
      });
    });

    socket.connect();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user]);

  /**
   * Subscribe to a specific authorized room
   */
  const subscribeToRoom = useCallback((room) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit("subscribe", { room });
  }, []);

  /**
   * Unsubscribe from a specific room
   */
  const unsubscribeFromRoom = useCallback((room) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit("unsubscribe", { room });
  }, []);

  /**
   * Add event listener with automatic cleanup return
   */
  const on = useCallback((event, handler) => {
    if (!socketRef.current) return () => {};
    socketRef.current.on(event, handler);
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, handler);
      }
    };
  }, []);

  /**
   * Remove event listener
   */
  const off = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler);
    }
  }, []);

  const value = {
    socket: socketRef.current,
    isConnected,
    connectionState,
    lastEvent,
    subscribeToRoom,
    unsubscribeFromRoom,
    on,
    off,
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used inside RealtimeProvider");
  }
  return context;
}

export default RealtimeContext;
