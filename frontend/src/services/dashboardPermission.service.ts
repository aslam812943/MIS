import api from './api';

export interface Position {
  role: string;
  department_id: string | null;
  department_name: string | null;
  user_count: number;
}

export const dashboardPermissionService = {
  /**
   * Explicit per-widget overrides for the CALLING user's own position, plus
   * the default that applies to anything not explicitly overridden.
   * `defaultVisible` is true for every role except 'employee' (which starts
   * with nothing visible until admin opts specific widgets in). 'admin'
   * always gets `{ defaultVisible: true, overrides: {} }`.
   */
  getMyHiddenWidgets: async (): Promise<{ defaultVisible: boolean; overrides: { [widgetKey: string]: boolean } }> => {
    const response = await api.get('/admin/dashboard-permissions/me');
    return response.data;
  },

  getPositions: async (): Promise<Position[]> => {
    const response = await api.get('/admin/dashboard-permissions/positions');
    return response.data;
  },

  getPositionPermissions: async (role: string, departmentId: string | null): Promise<{ [widgetKey: string]: boolean }> => {
    const response = await api.get(`/admin/dashboard-permissions/${role}/${departmentId || 'none'}`);
    return response.data;
  },

  savePositionPermissions: async (role: string, departmentId: string | null, updates: { [widgetKey: string]: boolean }) => {
    const response = await api.put(`/admin/dashboard-permissions/${role}/${departmentId || 'none'}`, { updates });
    return response.data;
  },
};

export default dashboardPermissionService;
