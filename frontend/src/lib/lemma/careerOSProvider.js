'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getLemmaClient, getLemmaConfig } from './client';

const CareerOSContext = createContext(null);

export function CareerOSProvider({ children }) {
  const [client, setClient] = useState(null);
  const [authState, setAuthState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const config = getLemmaConfig();

  useEffect(() => {
    if (!config.podId) {
      setLoading(false);
      return;
    }
    getLemmaClient()
      .then((c) => {
        setClient(c);
        setAuthState(c.auth.state);
        c.auth.onChange((state) => setAuthState(state));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const ensureReady = useCallback(() => {
    if (!config.podId) throw new Error('Lemma not configured. Set NEXT_PUBLIC_LEMMA_POD_ID');
    if (!client) throw new Error('Lemma client not ready');
  }, [client, config.podId]);

  const value = {
    client,
    authState,
    loading,
    error,
    config,
    isReady: !!client && !!config.podId,

    applications: {
      list: async () => {
        ensureReady();
        return client.records.list('applications');
      },
      get: async (id) => {
        ensureReady();
        return client.records.get('applications', id);
      },
      create: async (data) => {
        ensureReady();
        return client.records.create('applications', data);
      },
      update: async (id, data) => {
        ensureReady();
        return client.records.update('applications', id, data);
      },
      delete: async (id) => {
        ensureReady();
        return client.records.delete('applications', id);
      },
    },

    profile: {
      get: async () => {
        ensureReady();
        const records = await client.records.list('profiles');
        return records?.[0] || null;
      },
      save: async (data) => {
        ensureReady();
        const existing = await client.records.list('profiles');
        if (existing?.length > 0) {
          return client.records.update('profiles', existing[0].id, data);
        }
        return client.records.create('profiles', data);
      },
    },

    chats: {
      list: async () => {
        ensureReady();
        return client.records.list('chat_messages');
      },
      send: async (msg) => {
        ensureReady();
        return client.records.create('chat_messages', msg);
      },
    },
  };

  return (
    <CareerOSContext.Provider value={value}>
      {children}
    </CareerOSContext.Provider>
  );
}

export function useCareerOS() {
  const ctx = useContext(CareerOSContext);
  if (!ctx) throw new Error('useCareerOS must be used within CareerOSProvider');
  return ctx;
}

export function useLemmaReady() {
  const { isReady, loading, config } = useContext(CareerOSContext) || {};
  return { isReady: !!isReady, loading: !!loading, configured: !!config?.podId };
}
