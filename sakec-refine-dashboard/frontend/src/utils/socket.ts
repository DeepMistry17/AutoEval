import { io } from 'socket.io-client';

// 1. Grab your existing env variable (e.g., "http://localhost:3001/api")
const envUrl = import.meta.env.VITE_API_URL || '';

// 2. Strip "/api" from the end if it exists, otherwise default to your MobaXterm tunnel port
const SOCKET_URL = envUrl ? envUrl.replace(/\/api$/, '') : 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  autoConnect: false, 
  withCredentials: true,
  transports: ['websocket', 'polling'] // Forces WebSockets through the tunnel
});