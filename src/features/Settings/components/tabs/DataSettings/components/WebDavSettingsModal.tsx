import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../../../ui/i18';
import { CloudCog, RefreshCw, Save, Shirt, Star } from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../../../ui/primitives/OreDropdown';
import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import { OreSwitch } from '../../../../../../ui/primitives/OreSwitch';
import type { WebDavSettings } from '../../../../../../types/settings';
import type { WebDavSyncResult } from '../types';

interface WebDavSettingsModalProps {
  isOpen: boolean;
  draft: WebDavSettings;
  isSyncing: boolean;
  syncResult: WebDavSyncResult | null;
  error: string;
  onClose: () => void;
  onChange: (patch: Partial<WebDavSettings>) => void;
  onSave: () => void;
  onSync: () => Promise<void>;
}

const getEndpointHint = (address: string) => {
  try {
    const parsed = new URL(address.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return i18n.t('settings.data.webdav.addressProtocolError');
    const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    return i18n.t('settings.data.webdav.defaultPort', { protocol: parsed.protocol === 'https:' ? 'HTTPS' : 'HTTP', port });
  } catch {
    return i18n.t('settings.data.webdav.addressProtocolError');
  }
};

export const WebDavSettingsModal: React.FC<WebDavSettingsModalProps> = ({
  isOpen,
  draft,
  isSyncing,
  syncResult,
  error,
  onClose,
  onChange,
  onSave,
  onSync,
}) => {
  const { t } = useTranslation();
  const endpointHint = useMemo(() => getEndpointHint(draft.address), [draft.address]);
  const canSync = draft.address.trim() !== '' && (draft.syncFavorites || draft.syncSkinAssets) && !isSyncing;

  const autoSyncIntervalOptions = useMemo(
    () => [
      { label: t('settings.data.webdav.intervals.3h'), value: '3h' },
      { label: t('settings.data.webdav.intervals.12h'), value: '12h' },
      { label: t('settings.data.webdav.intervals.1d'), value: '1d' },
      { label: t('settings.data.webdav.intervals.3d'), value: '3d' },
      { label: t('settings.data.webdav.intervals.5d'), value: '5d' },
      { label: t('settings.data.webdav.intervals.7d'), value: '7d' },
      { label: t('settings.data.webdav.intervals.off'), value: 'off' },
    ],
    [t]
  );

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.data.webdav.title')}
      defaultFocusKey="webdav-address"
      className="w-[52rem] max-w-[calc(100vw-2rem)]"
      actions={(
        <div className="flex flex-row justify-end gap-3">
          <OreButton
            variant="secondary"
            onClick={onClose}
            focusKey="webdav-cancel"
            disabled={isSyncing}
          >
            {t('settings.data.webdav.close')}
          </OreButton>
          <OreButton
            variant="secondary"
            onClick={onSave}
            focusKey="webdav-save"
            disabled={isSyncing}
          >
            <Save size={16} className="mr-1.5" />
            {t('settings.data.webdav.save')}
          </OreButton>
          <OreButton
            variant="primary"
            onClick={() => { void onSync(); }}
            focusKey="webdav-sync"
            disabled={!canSync}
          >
            <RefreshCw size={16} className={`mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? t('settings.data.webdav.syncing') : t('settings.data.webdav.syncNow')}
          </OreButton>
        </div>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)]">
        <section className="grid min-w-0 gap-4">
          <div className="border-2 border-[#1E1E1F] bg-[#242526] p-3 text-sm leading-6 text-[#D0D1D4]">
            <div className="flex items-center gap-2 font-minecraft text-base text-white">
              <CloudCog size={16} className="text-[#6CC349]" />
              {t('settings.data.webdav.connectionTitle')}
            </div>
            <div className="mt-1 text-xs text-[#B1B2B5]">
              {t('settings.data.webdav.connectionDesc')}
            </div>
          </div>

          <OreInput
            label={t('settings.data.webdav.address')}
            value={draft.address}
            onChange={(event) => onChange({ address: event.target.value })}
            placeholder="https://dav.example.com/remote.php/dav/files/user/PiLauncher"
            description={endpointHint}
            focusKey="webdav-address"
          />
          <OreInput
            label={t('settings.data.webdav.username')}
            value={draft.username}
            onChange={(event) => onChange({ username: event.target.value })}
            placeholder={t('settings.data.webdav.usernamePlaceholder')}
            focusKey="webdav-username"
          />
          <OreInput
            label={t('settings.data.webdav.password')}
            type="password"
            value={draft.password}
            onChange={(event) => onChange({ password: event.target.value })}
            placeholder={t('settings.data.webdav.passwordPlaceholder')}
            focusKey="webdav-password"
          />
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-minecraft font-bold ore-text-shadow text-white">
              {t('settings.data.webdav.autoSyncInterval')}
            </label>
            <div className="relative focus-within:z-50 w-full">
              <OreDropdown
                options={autoSyncIntervalOptions}
                value={draft.autoSyncInterval || '1d'}
                onChange={(value) => onChange({ autoSyncInterval: value as WebDavSettings['autoSyncInterval'] })}
                className="w-full"
                focusKey="webdav-auto-sync-interval"
              />
            </div>
            <span className="text-xs font-minecraft mt-0.5 text-[#B1B2B5]">
              {t('settings.data.webdav.autoSyncIntervalDesc')}
            </span>
          </div>
        </section>

        <aside className="grid min-w-0 gap-4">
          <div className="border-2 border-[#1E1E1F] bg-[#242526] p-3 text-sm leading-6 text-[#D0D1D4]">
            <div className="flex items-center gap-2 font-minecraft text-base text-white">
              <CloudCog size={16} className="text-[#6CC349]" />
              {t('settings.data.webdav.backupItems')}
            </div>
            <div className="mt-1 text-xs text-[#B1B2B5]">
              {t('settings.data.webdav.backupDesc')}
            </div>
          </div>

          <div className="flex min-h-[8.75rem] flex-col justify-between border-2 border-[#1E1E1F] bg-[#242526] px-4 py-3">
            <div>
              <div className="flex items-center gap-2 font-minecraft text-sm text-white">
                <Star size={15} className="text-[#F5C84B]" />
                {t('settings.data.webdav.libraryFavorites')}
              </div>
              <div className="mt-1 text-xs leading-5 text-[#B1B2B5]">
                {t('settings.data.webdav.remoteDirPrefix')} <span className="font-mono">PiLauncherSync/favorites/operations</span>.
                {t('settings.data.webdav.operationDesc')}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-xs text-[#D0D1D4]">{t('settings.data.webdav.enableSync')}</span>
              <OreSwitch
                checked={draft.syncFavorites}
                onChange={(value) => onChange({ syncFavorites: value })}
                focusKey="webdav-sync-favorites"
              />
            </div>
          </div>

          <div className="flex min-h-[8.75rem] flex-col justify-between border-2 border-[#1E1E1F] bg-[#242526] px-4 py-3">
            <div>
              <div className="flex items-center gap-2 font-minecraft text-sm text-white">
                <Shirt size={15} className="text-[#6CC349]" />
                {t('settings.data.webdav.skinAssets')}
              </div>
              <div className="mt-1 text-xs leading-5 text-[#B1B2B5]">
                {t('settings.data.webdav.remoteDirPrefix')} <span className="font-mono">PiLauncherSync/wardrobe/skins</span>.
                {t('settings.data.webdav.skinBackupDesc')}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-xs text-[#D0D1D4]">{t('settings.data.webdav.enableSync')}</span>
              <OreSwitch
                checked={draft.syncSkinAssets}
                onChange={(value) => onChange({ syncSkinAssets: value })}
                focusKey="webdav-sync-skins"
              />
            </div>
          </div>
        </aside>
      </div>

      {(error || syncResult) && (
        <div className="mt-4 grid gap-3">
          {error && (
            <div className="border-2 border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {syncResult && (
            <div className="border-2 border-[#1D4D13] bg-[#1C2A1B] px-3 py-2 text-sm leading-6 text-[#A7F08A]">
              {syncResult.favorites && (
                <div>
                  {t('settings.data.webdav.favoriteResult', {
                    uploaded: syncResult.favorites.uploadedOperations,
                    downloaded: syncResult.favorites.downloadedOperations,
                    total: syncResult.favorites.totalOperations,
                    favorites: syncResult.favorites.mergedFavorites,
                    snapshot: syncResult.favorites.snapshotUpdated
                      ? t('settings.data.webdav.snapshotUpdated')
                      : t('settings.data.webdav.snapshotUnchanged'),
                    compacted: syncResult.favorites.compactedOperations,
                  })}
                </div>
              )}
              {syncResult.skins && (
                <div>
                  {t('settings.data.webdav.skinResult', {
                    uploaded: syncResult.skins.uploadedFiles,
                    downloaded: syncResult.skins.downloadedFiles,
                    local: syncResult.skins.localFiles,
                    remote: syncResult.skins.remoteFiles,
                    action: syncResult.skins.restored
                      ? t('settings.data.webdav.skinRestored')
                      : syncResult.skins.archiveUpdated
                        ? t('settings.data.webdav.skinUploaded')
                        : t('settings.data.webdav.skinUnchanged'),
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </OreModal>
  );
};
