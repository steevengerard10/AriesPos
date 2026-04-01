import { create } from 'zustand';

export type AlertEventType = 'item_removed' | 'cart_cleared' | 'sale_failed' | 'sale_cancelled';

export interface AlertEvent {
  id: string;
  type: AlertEventType;
  message: string;
  detail?: string;
  timestamp: Date;
  read: boolean;
}

interface AlertMonitorState {
  events: AlertEvent[];
  unread: number;
  addEvent: (type: AlertEventType, message: string, detail?: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

export const useAlertMonitorStore = create<AlertMonitorState>((set, get) => ({
  events: [],
  unread: 0,

  addEvent: (type, message, detail) => {
    const event: AlertEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      message,
      detail,
      timestamp: new Date(),
      read: false,
    };
    const events = [event, ...get().events].slice(0, 100); // máximo 100 eventos
    set({ events, unread: events.filter((e) => !e.read).length });
  },

  markAllRead: () => {
    set({ events: get().events.map((e) => ({ ...e, read: true })), unread: 0 });
  },

  clearAll: () => set({ events: [], unread: 0 }),
}));
