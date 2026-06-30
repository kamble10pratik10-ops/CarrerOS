import { LemmaClient } from 'lemma-sdk';

let _client = null;
let _initialized = false;

export function getLemmaConfig() {
  return {
    apiUrl: process.env.NEXT_PUBLIC_LEMMA_API_URL,
    authUrl: process.env.NEXT_PUBLIC_LEMMA_AUTH_URL,
    podId: process.env.NEXT_PUBLIC_LEMMA_POD_ID,
  };
}

export async function getLemmaClient() {
  if (!_client) {
    const config = getLemmaConfig();
    _client = new LemmaClient(config);
  }
  if (!_initialized) {
    await _client.initialize();
    _initialized = true;
  }
  return _client;
}

export function resetLemmaClient() {
  _client = null;
  _initialized = false;
}
