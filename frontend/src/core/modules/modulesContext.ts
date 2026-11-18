import { createContext, useContext } from 'react';

import { apiRequest } from '@/core/api/client';
import { SETTINGS_PATH } from '@/core/settings/routes';

/** Address of Ajustes > Módulos. */
export const MODULES_SETTINGS_PATH = `${SETTINGS_PATH}?aba=modulos`;

export const modulesApi = {
  get: () => apiRequest<{ disabled: string[] }>('/api/modules'),
  save: (disabled: string[]) =>
    apiRequest<{ disabled: string[] }>('/api/modules', {
      method: 'PUT',
      body: { disabled },
    }),
};

export interface ModulesContextValue {
  /** Keys of the modules turned off in Ajustes > Módulos. */
  disabled: string[];
  isEnabled: (key: string) => boolean;
  /** Saves the turned-off modules (the navigation and the screens follow at once). */
  save: (disabled: string[]) => Promise<void>;
}

export const ModulesContext = createContext<ModulesContextValue>({
  disabled: [],
  isEnabled: () => true,
  save: async () => undefined,
});

export function useModules(): ModulesContextValue {
  return useContext(ModulesContext);
}

/** Module that owns the address (the longest matching path wins). */
export function moduleOfPath<T extends { path: string }>(modules: T[], pathname: string): T | undefined {
  return modules.filter((m) => pathname === m.path || pathname.startsWith(`${m.path}/`)).sort((a, b) => b.path.length - a.path.length)[0];
}
