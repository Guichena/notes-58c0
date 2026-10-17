import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { createSocketStore } from './socket-store.mjs';
const SocketContext = createContext(null);
// Mount above the router. sessionKey changes on login/logout/account switch.
export function SocketProvider({ url, sessionKey, children }) {
  const store = useMemo(() => createSocketStore(url), [url, sessionKey]);
  useEffect(() => { store.start(); return () => store.stop(); }, [store]);
  return React.createElement(SocketContext.Provider, { value: store }, children);
}
export function useSharedSocket() {
  const store = useContext(SocketContext);
  if (!store) throw new Error('SocketProvider is required');
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...snapshot, send: store.send };
}
