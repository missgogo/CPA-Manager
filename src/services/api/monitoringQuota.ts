import { apiClient } from './client';

export interface MonitoringQuotaCacheResponse {
  accounts: Record<string, unknown>;
}

export const monitoringQuotaApi = {
  getAccountQuotaCache: () =>
    apiClient.get<MonitoringQuotaCacheResponse>('/monitoring/account-quotas'),

  saveAccountQuotaCache: (accounts: Record<string, unknown>) =>
    apiClient.put('/monitoring/account-quotas', { accounts }),
};
