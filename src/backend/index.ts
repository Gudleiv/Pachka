import { HAS_SUPABASE } from '../config';
import { LocalBackend } from './local';
import type { Backend } from './types';

/**
 * Supabase, если он сконфигурирован при сборке; иначе — демо без бэкенда.
 * Клиент Supabase грузится динамически, чтобы демо-сборка не тянула его в бандл.
 */
export async function createBackend(): Promise<Backend> {
  if (!HAS_SUPABASE) return new LocalBackend();
  const { SupabaseBackend } = await import('./supabase');
  return new SupabaseBackend();
}

export type { Backend };
