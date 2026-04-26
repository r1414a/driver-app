// FILE: lib/socket.js
// Socket.IO singleton — connects to your existing tripTracker.js backend
// Emits: join-delivery, get-location, get-updated-location
// Receives: joined-successfully, location-update, Alert
// ─────────────────────────────────────────────────────────────────────────

import { io } from "socket.io-client";
 
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.0.163:5000";
// const API_URL = "http://10.224.170.232:5000";
 
let socket = null;
 
export function getSocket(token) {
   if (socket && socket.connected) return socket;
 
  if (socket) {
    socket.disconnect();
    socket = null;
  }

    socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });


     socket.on("connect", () => console.log("[Socket] Connected:", socket.id));
  socket.on("disconnect", (r) => console.log("[Socket] Disconnected:", r));
  socket.on("connect_error", (e) => console.error("[Socket] Error:", e.message));
  return socket;
}
 
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
