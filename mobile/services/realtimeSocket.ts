import { io, Socket } from 'socket.io-client';
import { invalidateQueryPrefix } from './queryCache';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'http://localhost:3001';

export type SocketConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

let socketInstance: Socket | null = null;
let currentToken: string | null = null;
let bridgeWired = false;
const joinedBookingRooms = new Set<string>();
const stateListeners = new Set<(state: SocketConnectionState) => void>();
let currentState: SocketConnectionState = 'disconnected';

function setConnectionState(next: SocketConnectionState) {
  currentState = next;
  for (const fn of stateListeners) fn(next);
}

export function subscribeSocketState(
  listener: (state: SocketConnectionState) => void,
): () => void {
  stateListeners.add(listener);
  listener(currentState);
  return () => stateListeners.delete(listener);
}

export function joinBookingRoom(bookingId: string) {
  joinedBookingRooms.add(bookingId);
  if (socketInstance?.connected) {
    socketInstance.emit('booking:join', { bookingId });
  }
}

export function leaveBookingRoom(bookingId: string) {
  joinedBookingRooms.delete(bookingId);
}

export function getRealtimeSocket(token?: string | null): Socket {
  if (!socketInstance || (token && token !== currentToken)) {
    if (socketInstance) {
      socketInstance.disconnect();
    }
    bridgeWired = false;
    currentToken = token ?? null;
    setConnectionState('connecting');
    socketInstance = io(`${WS_URL}/realtime`, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      auth: token ? { token } : undefined,
    });
  }

  if (!bridgeWired && socketInstance) {
    bridgeWired = true;
    socketInstance.on('connect', () => {
      setConnectionState('connected');
      for (const bookingId of joinedBookingRooms) {
        socketInstance?.emit('booking:join', { bookingId });
      }
    });
    socketInstance.on('disconnect', () => {
      setConnectionState('reconnecting');
    });
    socketInstance.io.on('reconnect_attempt', () => {
      setConnectionState('reconnecting');
    });
    socketInstance.on('booking:created', () => {
      invalidateQueryPrefix('bookings:');
    });
    socketInstance.on('booking:updated', () => {
      invalidateQueryPrefix('bookings:');
    });
    socketInstance.on('trip:updated', () => {
      invalidateQueryPrefix('trips:');
    });
    socketInstance.on('checkin:updated', () => {
      invalidateQueryPrefix('trips:');
    });
    socketInstance.on('notification:new', () => {
      invalidateQueryPrefix('notifications:');
    });
    socketInstance.on('verification:updated', () => {
      invalidateQueryPrefix('verification:');
    });
  }

  return socketInstance;
}

export function disconnectRealtimeSocket() {
  joinedBookingRooms.clear();
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    currentToken = null;
    bridgeWired = false;
  }
  setConnectionState('disconnected');
}
