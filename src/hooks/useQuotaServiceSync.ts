import { useEffect, useMemo, useRef } from 'react';
import { detectApiBaseFromLocation } from '@/utils/connection';
import { useAuthStore, useQuotaStore, useUsageServiceStore } from '@/stores';
import {
  isUsageServiceId,
  normalizeUsageServiceBase,
  type QuotaCachePayload,
  usageServiceApi,
} from '@/services/api/usageService';

const EMPTY_OBJECT = {};

export function useQuotaServiceSync() {
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const usageServiceEnabled = useUsageServiceStore((state) => state.enabled);
  const usageServiceBase = useUsageServiceStore((state) => state.serviceBase);

  const quotaSnapshot = useQuotaStore((state) => ({
    antigravityQuota: state.antigravityQuota,
    claudeQuota: state.claudeQuota,
    codexQuota: state.codexQuota,
    geminiCliQuota: state.geminiCliQuota,
    kimiQuota: state.kimiQuota,
    monitoringAccountQuota: state.monitoringAccountQuota,
  }));

  const snapshotJson = useMemo(() => JSON.stringify(quotaSnapshot), [quotaSnapshot]);
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    let cancelled = false;

    const resolveUsageServiceBase = async (): Promise<string> => {
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
    };

    void (async () => {
      const serviceBase = await resolveUsageServiceBase();
      if (cancelled) return;
      hydratedRef.current = true;
      if (!serviceBase) return;
      try {
        const response = await usageServiceApi.getQuotaCache(serviceBase, managementKey);
        if (cancelled) return;
        const cache = response?.cache;
        if (!cache || typeof cache !== 'object') return;
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
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBase, connectionStatus, managementKey, usageServiceBase, usageServiceEnabled]);

  useEffect(() => {
    if (!hydratedRef.current || connectionStatus !== 'connected') return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        const serviceBase =
          usageServiceEnabled && usageServiceBase ? usageServiceBase : normalizeUsageServiceBase(detectApiBaseFromLocation());
        if (!serviceBase) return;
        const payload: QuotaCachePayload = JSON.parse(snapshotJson || JSON.stringify(EMPTY_OBJECT));
        try {
          await usageServiceApi.saveQuotaCache(serviceBase, payload, managementKey);
        } catch {
          // ignore
        }
      })();
    }, 300);
  }, [
    connectionStatus,
    managementKey,
    snapshotJson,
    usageServiceBase,
    usageServiceEnabled,
  ]);
}
