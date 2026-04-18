import { io } from "socket.io-client";
import { API_BASE_URL } from "./config/api";

export function createSocket(token, options = {}) {
  const { transports = ["polling", "websocket"] } = options;

  return io(API_BASE_URL, {
    auth: { token },
    autoConnect: false,
    transports,
    withCredentials: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
    timeout: 20000,
  });
}
