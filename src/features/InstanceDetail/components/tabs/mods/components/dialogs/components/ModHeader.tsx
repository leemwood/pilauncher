// src/features/InstanceDetail/components/tabs/mods/components/dialogs/components/ModHeader.tsx
import React from 'react';
import { Blocks, Loader2 } from 'lucide-react';
import { useModIcon } from '../../../../../../logic/modIconService';
import { getModPreferredPlatform, type ModMeta } from '../../../../../../logic/modService';
import { PLATFORM_LABELS } from '../utils/modDetailUtils';

interface ModHeaderProps {
  mod: ModMeta;
  displayMod: ModMeta | null;
}

export const ModHeader: React.FC<ModHeaderProps> = ({ mod, displayMod }) => {
  const activeIconMod = displayMod || mod;
  const iconSnapshot = useModIcon(activeIconMod, 'high');

  const preferredMetadataPlatform = displayMod ? getModPreferredPlatform(displayMod, 'metadata') : undefined;
  const sourceLabel = preferredMetadataPlatform
    ? PLATFORM_LABELS[preferredMetadataPlatform]
    : displayMod?.networkInfo?.source === 'curseforge'
      ? 'CurseForge'
      : displayMod?.networkInfo?.source === 'modrinth' || displayMod?.manifestEntry?.source.platform === 'modrinth'
      ? 'Modrinth'
      : displayMod?.manifestEntry?.source.platform || '本地';

  const detailIconUrl = iconSnapshot.src || displayMod?.networkIconUrl || displayMod?.networkInfo?.icon_url || '';

  return (
    <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 shrink-0 font-minecraft">
      <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto sm:mx-0 flex-shrink-0 bg-[var(--ore-color-background-surface-deep)] border-[2px] border-[var(--ore-border-color)] flex items-center justify-center p-1 rounded-sm relative shadow-sm">
        {mod.isFetchingNetwork && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="animate-spin text-ore-green" />
          </div>
        )}

        {detailIconUrl ? (
          <img src={detailIconUrl} alt="icon" className="w-full h-full object-cover rounded-sm" />
        ) : (
          <Blocks size={36} className="text-gray-600" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center text-center sm:text-left">
        <h2 className="text-lg sm:text-xl font-minecraft text-white drop-shadow-sm flex flex-col sm:flex-row items-center sm:justify-start gap-2 sm:gap-3 truncate mb-1.5">
          <span className="truncate">{displayMod?.name || displayMod?.networkInfo?.title || displayMod?.fileName}</span>
          {!displayMod?.isEnabled && (
            <span className="flex-shrink-0 text-xs bg-[var(--ore-color-background-danger-subtle)] text-[var(--ore-color-text-danger-default)] px-1.5 py-0.5 rounded-[2px] border-[2px] border-[var(--ore-border-color)] tracking-wider">
              已禁用
            </span>
          )}
        </h2>
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 sm:gap-x-5 gap-y-1.5 text-xs sm:text-sm text-gray-400">
          <span className="truncate max-w-[12rem] sm:max-w-xs">文件: {displayMod?.fileName}</span>
          <span>大小: {displayMod?.fileSize ? (displayMod.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '未知'}</span>
          <span>来源: {sourceLabel}</span>
          <span>状态: {mod.isFetchingNetwork ? '匹配中...' : (displayMod?.networkInfo ? `已链接至 ${sourceLabel}` : '未找到匹配项目')}</span>
        </div>
      </div>
    </div>
  );
};
