// src/features/InstanceDetail/components/tabs/mods/components/dialogs/utils/modDetailUtils.ts
import {
  matchModrinthVersionsByHashes,
  type ModrinthProject,
  type OreProjectDetail
} from '../../../../../../logic/modrinthApi';
import { matchCurseForgeFingerprints } from '../../../../../../../Download/logic/curseforgeApi';
import {
  getModPlatformReference,
  type ModMeta,
  type ModPlatformId,
  type ModPlatformPreference
} from '../../../../../../logic/modService';

export const PLATFORM_TABS = [
  { id: 'auto', label: '自动' },
  { id: 'modrinth', label: 'Modrinth' },
  { id: 'curseforge', label: 'CurseForge' }
];

export const HISTORY_PLATFORM_TABS = [
  { id: 'modrinth', label: 'Modrinth' },
  { id: 'curseforge', label: 'CurseForge' }
];

export const PLATFORM_LABELS: Record<ModPlatformId, string> = {
  modrinth: 'Modrinth',
  curseforge: 'CurseForge'
};

export const normalizePreference = (value?: string): ModPlatformPreference => (
  value === 'modrinth' || value === 'curseforge' ? value : 'auto'
);

export const getPlatformProjectId = (mod: ModMeta | null, platform: ModPlatformId) => {
  if (!mod) return undefined;
  return (mod.networkInfo?.source === platform ? mod.networkInfo.id : undefined)
    || getModPlatformReference(mod, platform)?.projectId
    || (mod.manifestEntry?.source.platform === platform ? mod.manifestEntry.source.projectId : undefined);
};

export const getPlatformFileId = (mod: ModMeta | null, platform: ModPlatformId) => {
  if (!mod) return undefined;
  return getModPlatformReference(mod, platform)?.fileId
    || (mod.manifestEntry?.source.platform === platform ? mod.manifestEntry.source.fileId : undefined);
};

export const toNetworkInfo = (detail: OreProjectDetail, source: 'modrinth' | 'curseforge'): ModrinthProject => ({
  id: detail.id,
  project_id: detail.id,
  slug: detail.id,
  title: detail.title,
  description: detail.description,
  icon_url: detail.icon_url || '',
  author: detail.author,
  downloads: detail.downloads,
  date_modified: detail.updated_at,
  client_side: detail.client_side,
  server_side: detail.server_side,
  follows: detail.followers,
  loaders: detail.loaders,
  categories: detail.loaders,
  display_categories: detail.loaders,
  gallery_urls: detail.gallery_urls,
  source
});

export const resolveProjectIdByHash = async (
  mod: ModMeta,
  platform: ModPlatformId
): Promise<string | undefined> => {
  if (platform === 'modrinth') {
    const sha1 = mod.manifestEntry?.hash?.value;
    if (sha1 && mod.manifestEntry?.hash?.algorithm === 'sha1') {
      try {
        const matches = await matchModrinthVersionsByHashes([sha1], 'sha1');
        return matches[sha1]?.project_id;
      } catch (err) {
        console.error('Modrinth hash matching failed:', err);
      }
    }
  } else if (platform === 'curseforge') {
    const fingerprint = mod.curseforgeFingerprint;
    if (typeof fingerprint === 'number') {
      try {
        const matches = await matchCurseForgeFingerprints([fingerprint]);
        return matches[fingerprint]?.project_id;
      } catch (err) {
        console.error('CurseForge fingerprint matching failed:', err);
      }
    }
  }
  return undefined;
};
