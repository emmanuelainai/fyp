import { useEffect, useMemo } from "react";
import { io, type Socket } from "socket.io-client";
import { SOCKET_URL } from "../api/http";
import { useAuth } from "../context/AuthContext";

export const useSocket = (): Socket | null => {
  const { token } = useAuth();

  const socket = useMemo(() => {
    if (!token) return null;
    return io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"]
    });
  }, [token]);

  useEffect(() => {
    return () => {
      socket?.disconnect();
    };
  }, [socket]);

  return socket;
};
