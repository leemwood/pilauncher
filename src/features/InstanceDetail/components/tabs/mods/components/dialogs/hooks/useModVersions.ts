// src/features/InstanceDetail/components/tabs/mods/components/dialogs/hooks/useModVersions.ts
import { useEffect, useRef, useState } from 'react';
import {
  fetchModrinthVersions,
  searchModrinth
} from '../../../../../../logic/modrinthApi';
import {
  fetchCurseForgeVersions,
  searchCurseForge,
  hasCurseForgeApiKey
} from '../../../../../../../Download/logic/curseforgeApi';
import {
  resolveInstanceGameVersion,
  resolveInstanceLoader,
  type ModMeta,
  type ModPlatformId
} from '../../../../../../logic/modService';
import {
  getPlatformProjectId,
  resolveProjectIdByHash
} from '../utils/modDetailUtils';

export const useModVersions = (
  displayMod: ModMeta | null,
  activePlatform: ModPlatformId,
  instanceConfig: any
) => {
  const [modVersions, setModVersions] = useState<any[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  
  // Cache versions fetched during the lifetime of the opened dialog.
  // Using useRef ensures updating cache does not trigger effect cycles.
  const cacheRef = useRef<Record<string, any[]>>({});

  // Invalidate cache when displayMod changes.
  useEffect(() => {
    cacheRef.current = {};
  }, [displayMod?.fileName]);

  useEffect(() => {
    if (displayMod && instanceConfig) {
      const cacheKey = activePlatform;
      
      // If version history for the active platform is already cached, return immediately
      if (cacheRef.current[cacheKey]) {
        setModVersions(cacheRef.current[cacheKey]);
        setIsLoadingVersions(false);
        return;
      }

      setIsLoadingVersions(true);

      const fetchPlatformVersions = async () => {
        if (activePlatform === 'curseforge' && !hasCurseForgeApiKey()) {
          cacheRef.current[cacheKey] = [];
          setModVersions([]);
          return;
        }
        let currentProjectId = getPlatformProjectId(displayMod, activePlatform)
          || (activePlatform === 'modrinth' ? displayMod.modId : undefined);

        // 1. Prioritize hash query
        if (!currentProjectId) {
          currentProjectId = await resolveProjectIdByHash(displayMod, activePlatform);
        }

        // 2. Fall back to fuzzy text search
        if (!currentProjectId) {
          const query = displayMod.modId || displayMod.name || displayMod.fileName.replace('.jar', '').replace('.disabled', '').replace(/[-_v0-9\.]+$/, '');

          if (activePlatform === 'curseforge') {
            const res = await searchCurseForge({ query, limit: 1 });
            if (res.hits.length > 0) currentProjectId = res.hits[0].id;
          } else {
            const res = await searchModrinth({ query, limit: 1 });
            if (res.hits.length > 0) currentProjectId = res.hits[0].id;
          }
        }

        if (!currentProjectId) {
          cacheRef.current[cacheKey] = [];
          setModVersions([]);
          return;
        }

        const targetMc = resolveInstanceGameVersion(instanceConfig);
        const targetLoader = resolveInstanceLoader(instanceConfig);
        const fetchVersions = activePlatform === 'curseforge'
          ? fetchCurseForgeVersions
          : fetchModrinthVersions;

        const res = await fetchVersions(currentProjectId, targetMc, targetLoader);
        cacheRef.current[cacheKey] = res;
        setModVersions(res);
      };

      fetchPlatformVersions()
        .catch(err => {
          console.error("获取版本失败:", err);
          cacheRef.current[cacheKey] = [];
          setModVersions([]);
        })
        .finally(() => setIsLoadingVersions(false));
    } else {
      setModVersions([]);
    }
  }, [displayMod, instanceConfig, activePlatform]);

  return {
    modVersions,
    isLoadingVersions
  };
};
