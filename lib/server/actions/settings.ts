'use server';

import { getSetting, setSetting } from '@/lib/server/repo/settings';

export async function getSettingAction<T = unknown>(key: string): Promise<T | null> {
  return getSetting<T>(key);
}

export async function setSettingAction<T>(key: string, value: T): Promise<void> {
  return setSetting(key, value);
}
