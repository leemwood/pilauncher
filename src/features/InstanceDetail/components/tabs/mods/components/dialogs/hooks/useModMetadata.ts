// src/features/InstanceDetail/components/tabs/mods/components/dialogs/hooks/useModMetadata.ts
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchModrinthInfo,
  fetchModrinthProjectById
} from '../../../../../../logic/modrinthApi';
import { getCurseForgeProjectDetails } from '../../../../../../../Download/logic/curseforgeApi';
import {
  getModPreferredPlatform,
  modService,
  type ModMeta,
  type ModPlatformId
} from '../../../../../../logic/modService';
import {
  getPlatformFileId,
  getPlatformProjectId,
  resolveProjectIdByHash,
  toNetworkInfo
} from '../utils/modDetailUtils';

export const useModMetadata = (
  mod: ModMeta | null,
  onMetadataResolved?: (mod: ModMeta) => void,
  instanceConfig?: any
) => {
  const [displayMod, setDisplayMod] = useState<ModMeta | null>(null);
  const lastOpenedFileNameRef = useRef<string | null>(null);
  const fetchedMetadataKeysRef = useRef<Set<string>>(new Set());

  const initialMetadataPlatform = useMemo<ModPlatformId>(() => {
    if (!mod) return 'modrinth';
    const sourcePlatform = getModPreferredPlatform(mod, 'metadata') 
      || mod.manifestEntry?.source.platform
      || instanceConfig?.globalMetadataSettings?.metadataPlatform;
    return sourcePlatform === 'curseforge' ? 'curseforge' : 'modrinth';
  }, [mod, instanceConfig]);

  const metadataRequestKey = useMemo(() => {
    if (!mod) return '';

    return [
      mod.fileName,
      mod.cacheKey || '',
      initialMetadataPlatform,
      getPlatformProjectId(mod, initialMetadataPlatform) || '',
      getPlatformFileId(mod, initialMetadataPlatform) || '',
      mod.manifestEntry?.hash?.algorithm || '',
      mod.manifestEntry?.hash?.value || '',
      mod.curseforgeFingerprint ?? '',
      mod.modId || ''
    ].join('|');
  }, [initialMetadataPlatform, mod]);

  // Sync displayMod when mod changes
  useEffect(() => {
    if (!mod) {
      setDisplayMod(null);
      lastOpenedFileNameRef.current = null;
      return;
    }

    setDisplayMod((current) => {
      const nextMod = {
        ...mod,
        networkInfo: mod.networkInfo || current?.networkInfo,
        networkIconUrl: mod.networkIconUrl || current?.networkIconUrl
      };

      if (
        current?.fileName === nextMod.fileName &&
        current.name === nextMod.name &&
        current.description === nextMod.description &&
        current.version === nextMod.version &&
        current.fileSize === nextMod.fileSize &&
        current.isEnabled === nextMod.isEnabled &&
        current.isFetchingNetwork === nextMod.isFetchingNetwork &&
        current.networkInfo === nextMod.networkInfo &&
        current.networkIconUrl === nextMod.networkIconUrl
      ) {
        return current;
      }

      return nextMod;
    });

    if (lastOpenedFileNameRef.current !== mod.fileName) {
      lastOpenedFileNameRef.current = mod.fileName;
    }
  }, [mod]);

  // Fetch metadata details from APIs
  useEffect(() => {
    if (mod && metadataRequestKey) {
      let disposed = false;

      if (fetchedMetadataKeysRef.current.has(metadataRequestKey)) {
        return;
      }
      fetchedMetadataKeysRef.current.add(metadataRequestKey);

      const fetchMetadata = async () => {
        let projectId = getPlatformProjectId(mod, initialMetadataPlatform);
        if (!projectId) {
          projectId = await resolveProjectIdByHash(mod, initialMetadataPlatform);
        }

        if (projectId) {
          return initialMetadataPlatform === 'curseforge'
            ? getCurseForgeProjectDetails(projectId).then((detail) => toNetworkInfo(detail, 'curseforge'))
            : fetchModrinthProjectById(projectId);
        } else {
          const query =
            mod.modId ||
            mod.fileName.replace('.jar', '').replace('.disabled', '').replace(/[-_v0-9\.]+$/, '');
          return fetchModrinthInfo(query);
        }
      };

      fetchMetadata().then(netInfo => {
        if (disposed) {
          return;
        }

        if (netInfo) {
          const resolvedMod: ModMeta = {
            ...mod,
            networkInfo: netInfo,
            networkIconUrl: netInfo.icon_url || mod.networkIconUrl,
            isFetchingNetwork: false
          };

          setDisplayMod(prev => prev ? {
            ...prev,
            networkInfo: netInfo,
            networkIconUrl: netInfo.icon_url || prev.networkIconUrl,
            isFetchingNetwork: false
          } : null);
          onMetadataResolved?.(resolvedMod);

          if (mod.cacheKey) {
            modService.updateModCache(
              mod.cacheKey,
              netInfo.title, netInfo.description, netInfo.icon_url
            ).catch(console.error);
          }
        }
      }).catch((error) => {
        if (!disposed) {
          fetchedMetadataKeysRef.current.delete(metadataRequestKey);
        }
        console.error(error);
      });

      return () => {
        disposed = true;
      };
    }
  }, [initialMetadataPlatform, metadataRequestKey, mod, onMetadataResolved]);

  return {
    displayMod,
    setDisplayMod,
    initialMetadataPlatform
  };
};
