// FILE: lib/socket.js
// Socket.IO singleton — connects to your existing tripTracker.js backend
// Emits: join-delivery, get-location, get-updated-location
// Receives: joined-successfully, location-update, Alert
// ─────────────────────────────────────────────────────────────────────────

import { io } from "socket.io-client";
 
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.100:3000";
 
let socket = null;
 
export function getSocket(token) {
  if (!socket || !socket.connected) {
    socket = io(API_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });
  }
  return socket;
}
 
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
