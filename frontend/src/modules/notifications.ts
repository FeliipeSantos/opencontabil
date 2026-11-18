import type { NotificationGroup } from '@/core/layout/notifications';
import { useModules } from '@/core/modules/modulesContext';
import { useCriticalNotifications } from '@/modules/intelligence/hooks/useCriticalNotifications';
import { useCalendarNotifications } from '@/modules/reforma/hooks/useCalendarNotifications';

/**
 * Notifications of every module for the global header. A module that raises alerts
 * adds its hook here; the header shows the groups in this order.
 */
export function useModuleNotifications(): NotificationGroup[] {
  // módulo desligado em Ajustes > Módulos não consulta nem avisa
  const { isEnabled } = useModules();
  const critical = useCriticalNotifications(isEnabled('intelligence'));
  const calendar = useCalendarNotifications(isEnabled('reforma'));
  return [critical, calendar].filter((group): group is NotificationGroup => group !== null);
}
