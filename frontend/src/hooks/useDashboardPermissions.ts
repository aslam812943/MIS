import { useEffect, useState } from 'react';
import { dashboardPermissionService } from '../services/dashboardPermission.service';

/**
 * Fetches the current user's own widget-visibility settings (resolved
 * server-side from their real role/department — never trusts a
 * client-supplied role) and returns a simple `isVisible(widgetKey)` check.
 * Fails open (shows everything) on a fetch error so a permissions-API
 * hiccup never blanks out someone's whole dashboard.
 */
export function useDashboardPermissions() {
  const [defaultVisible, setDefaultVisible] = useState(true);
  const [overrides, setOverrides] = useState<{ [widgetKey: string]: boolean }>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    dashboardPermissionService
      .getMyHiddenWidgets()
      .then((result) => {
        if (cancelled) return;
        setDefaultVisible(result.defaultVisible);
        setOverrides(result.overrides || {});
      })
      .catch(() => {
        if (!cancelled) {
          setDefaultVisible(true);
          setOverrides({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isVisible = (widgetKey: string): boolean =>
    widgetKey in overrides ? overrides[widgetKey] : defaultVisible;

  return { isVisible, permissionsLoaded: loaded };
}
