import { useCallback } from 'react';
import { detectApiBaseFromLocation } from '@/utils/connection';
import { useAuthStore, useQuotaStore, useUsageServiceStore } from '@/stores';
import {
  isUsageServiceId,
  normalizeUsageServiceBase,
  type QuotaCachePayload,
  usageServiceApi,
} from '@/services/api/usageService';

const buildQuotaCachePayload = (): QuotaCachePayload => {
  const state = useQuotaStore.getState();
  return {
    antigravityQuota: state.antigravityQuota,
    claudeQuota: state.claudeQuota,
    codexQuota: state.codexQuota,
    geminiCliQuota: state.geminiCliQuota,
    kimiQuota: state.kimiQuota,
    monitoringAccountQuota: state.monitoringAccountQuota,
  };
};

export function useQuotaCacheService() {
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const usageServiceEnabled = useUsageServiceStore((state) => state.enabled);
  const usageServiceBase = useUsageServiceStore((state) => state.serviceBase);

  const resolveUsageServiceBase = useCallback(async (): Promise<string> => {
    if (usageServiceEnabled && usageServiceBase) {
      return usageServiceBase;
    }

    const candidates = Array.from(
      new Set(
        [apiBase, detectApiBaseFromLocation()]
          .map((value) => normalizeUsageServiceBase(value || ''))
          .filter(Boolean)
      )
    );

    for (const candidate of candidates) {
      try {
        const info = await usageServiceApi.getInfo(candidate);
        if (isUsageServiceId(info.service)) {
          return candidate;
        }
      } catch {
        // ignore
      }
    }

    return '';
  }, [apiBase, usageServiceBase, usageServiceEnabled]);

  const hydrateQuotaCache = useCallback(async () => {
    const serviceBase = await resolveUsageServiceBase();
    if (!serviceBase) return false;
    const response = await usageServiceApi.getQuotaCache(serviceBase, managementKey);
    const cache =
      response && response.cache && typeof response.cache === 'object' ? response.cache : {};
    useQuotaStore.setState((state) => ({
      ...state,
      antigravityQuota:
        (cache.antigravityQuota as typeof state.antigravityQuota | undefined) ?? state.antigravityQuota,
      claudeQuota: (cache.claudeQuota as typeof state.claudeQuota | undefined) ?? state.claudeQuota,
      codexQuota: (cache.codexQuota as typeof state.codexQuota | undefined) ?? state.codexQuota,
      geminiCliQuota:
        (cache.geminiCliQuota as typeof state.geminiCliQuota | undefined) ?? state.geminiCliQuota,
      kimiQuota: (cache.kimiQuota as typeof state.kimiQuota | undefined) ?? state.kimiQuota,
      monitoringAccountQuota:
        (cache.monitoringAccountQuota as typeof state.monitoringAccountQuota | undefined) ??
        state.monitoringAccountQuota,
    }));
    return true;
  }, [managementKey, resolveUsageServiceBase]);

  const persistQuotaCache = useCallback(async () => {
    const serviceBase = await resolveUsageServiceBase();
    if (!serviceBase) return false;
    await usageServiceApi.saveQuotaCache(serviceBase, buildQuotaCachePayload(), managementKey);
    return true;
  }, [managementKey, resolveUsageServiceBase]);

  return { hydrateQuotaCache, persistQuotaCache };
}
