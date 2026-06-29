'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { LemmaClient } from 'lemma-sdk';
import { AuthGuard } from 'lemma-sdk/react';

const LemmaContext = createContext(null);

function LemmaConfigDisplay() {
  const hasPodId = !!process.env.NEXT_PUBLIC_LEMMA_POD_ID;
  if (hasPodId) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#1a1a2e', color: '#e94560',
      padding: '12px 24px', fontSize: 13, fontFamily: 'monospace',
      zIndex: 9999, borderTop: '2px solid #e94560',
      textAlign: 'center'
    }}>
      ⚡ Lemma SDK installed but not configured.{' '}
      Set <strong>NEXT_PUBLIC_LEMMA_POD_ID</strong> in .env.local
    </div>
  );
}

export function LemmaProvider({ children }) {
  const [client, setClient] = useState(null);
  const [authState, setAuthState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const initialized = useRef(false);

  const config = {
    apiUrl: process.env.NEXT_PUBLIC_LEMMA_API_URL,
    authUrl: process.env.NEXT_PUBLIC_LEMMA_AUTH_URL,
    podId: process.env.NEXT_PUBLIC_LEMMA_POD_ID,
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!config.podId) {
      setLoading(false);
      return;
    }

    const c = new LemmaClient(config);
    c.initialize()
      .then((state) => {
        setClient(c);
        setAuthState(state);
        c.auth.onChange((s) => setAuthState(s));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const value = {
    client,
    authState,
    loading,
    error,
    config,
    isReady: !!client && !!config.podId,

    applications: {
      list: async () => {
        if (!client) throw new Error('Lemma not ready');
        return client.records.list('applications');
      },
      get: async (id) => {
        if (!client) throw new Error('Lemma not ready');
        return client.records.get('applications', id);
      },
      create: async (data) => {
        if (!client) throw new Error('Lemma not ready');
        return client.records.create('applications', data);
      },
      update: async (id, data) => {
        if (!client) throw new Error('Lemma not ready');
        return client.records.update('applications', id, data);
      },
      delete: async (id) => {
        if (!client) throw new Error('Lemma not ready');
        return client.records.delete('applications', id);
      },
    },

    profiles: {
      list: async () => {
        if (!client) throw new Error('Lemma not ready');
        return client.records.list('profiles');
      },
      get: async (id) => {
        if (!client) throw new Error('Lemma not ready');
        return client.records.get('profiles', id);
      },
      save: async (data) => {
        if (!client) throw new Error('Lemma not ready');
        const existing = await client.records.list('profiles');
        if (existing?.length > 0) {
          return client.records.update('profiles', existing[0].id, data);
        }
        return client.records.create('profiles', data);
      },
    },

    chatMessages: {
      list: async (filters) => {
        if (!client) throw new Error('Lemma not ready');
        if (filters) return client.records.list('chat_messages', filters);
        return client.records.list('chat_messages');
      },
      send: async (data) => {
        if (!client) throw new Error('Lemma not ready');
        return client.records.create('chat_messages', { ...data, timestamp: new Date().toISOString() });
      },
    },
  };

  return (
    <LemmaContext.Provider value={value}>
      {children}
      <LemmaConfigDisplay />
    </LemmaContext.Provider>
  );
}

export function useLemma() {
  const ctx = useContext(LemmaContext);
  if (!ctx) throw new Error('useLemma must be used within LemmaProvider');
  return ctx;
}

export function useLemmaStatus() {
  const ctx = useContext(LemmaContext);
  if (!ctx) return { loading: false, isReady: false, configured: false };
  return {
    loading: ctx.loading,
    isReady: ctx.isReady,
    configured: !!ctx.config?.podId,
    error: ctx.error,
  };
}

export { LemmaClient, AuthGuard };
