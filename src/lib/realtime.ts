import { useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const REALTIME_CHANNEL_NAME = 'app-realtime-sync';

// Global broadcast channel instance
let globalChannel: any = null;

export function getRealtimeChannel() {
  if (!globalChannel) {
    globalChannel = supabase.channel(REALTIME_CHANNEL_NAME, {
      config: {
        broadcast: { self: false }
      }
    });
    
    globalChannel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        console.log('>>> [REALTIME] Connected to global realtime channel');
      }
    });
  }
  return globalChannel;
}

/**
 * Notifies all connected clients (and local listeners) that data in one or more tables has changed.
 */
export function notifyDataChange(tables: string | string[]) {
  const tableList = Array.isArray(tables) ? tables : [tables];
  
  // 1. Dispatch local event for instant update in the same window
  tableList.forEach(table => {
    window.dispatchEvent(new CustomEvent('app:db_change', { detail: { table } }));
  });

  // 2. Broadcast to other connected clients via Supabase Realtime channel
  try {
    const channel = getRealtimeChannel();
    tableList.forEach(table => {
      channel.send({
        type: 'broadcast',
        event: 'db_change',
        payload: { table, timestamp: Date.now() }
      }).catch((err: any) => console.warn('Realtime broadcast warning:', err));
    });
  } catch (err) {
    console.warn('Realtime notify warning:', err);
  }
}

/**
 * React hook to subscribe to real-time changes for specific database tables.
 * Triggers callback whenever local or remote changes happen to any listed table.
 */
export function useRealtimeSubscription(tables: string[], onDataChange: (table?: string, isRemote?: boolean, payload?: any) => void) {
  const callbackRef = useRef(onDataChange);
  const tablesRef = useRef(tables);

  useEffect(() => {
    callbackRef.current = onDataChange;
    tablesRef.current = tables;
  });

  const key = [...tables].sort().join(',');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    
    // Debounced callback to avoid rapid duplicate refetches
    const triggerUpdate = (changedTable?: string, isRemote: boolean = false, payload?: any) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        callbackRef.current(changedTable, isRemote, payload);
      }, 150);
    };

    // 1. Listen for local window events
    const handleLocalEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ table: string }>;
      const changedTable = customEvent.detail?.table;
      if (!changedTable || tablesRef.current.includes(changedTable) || tablesRef.current.includes('*')) {
        triggerUpdate(changedTable, false);
      }
    };

    window.addEventListener('app:db_change', handleLocalEvent);

    // 2. Listen to broadcast channel from other users
    const channel = getRealtimeChannel();
    const broadcastSubscription = channel.on('broadcast', { event: 'db_change' }, (payload: any) => {
      const changedTable = payload?.payload?.table;
      if (!changedTable || tablesRef.current.includes(changedTable) || tablesRef.current.includes('*')) {
        triggerUpdate(changedTable, true, payload);
      }
    });

    // 3. Listen to Postgres changes natively as fallback
    const pgChannelName = `pg-changes-${tables.sort().join('-')}-${Math.random().toString(36).slice(2, 7)}`;
    const pgChannel = supabase.channel(pgChannelName);

    tables.forEach(table => {
      pgChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload: any) => {
          triggerUpdate(table, true, payload);
        }
      );
    });

    pgChannel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('app:db_change', handleLocalEvent);
      supabase.removeChannel(pgChannel);
    };
  }, [key]);
}
