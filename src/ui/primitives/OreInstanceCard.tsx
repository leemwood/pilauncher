// /src/ui/primitives/OreInstanceCard.tsx
import React from 'react';
import { Play } from 'lucide-react'; // 用于选中状态的小图标，可选
import { useTranslation } from 'react-i18next';
import { formatPlayTime } from '../../utils/formatters';

export interface OreInstanceCardProps {
  id: string;
  name: string;
  mcVersion: string;
  loaderType: string; // 例如: "Fabric 0.15.7", "Forge 47.2.0", "Vanilla"
  lastPlayed: string; // 例如: "2026-02-24" 或 "今天"
  playTime?: number;  // 游玩时间 (秒)
  coverUrl?: string;  // 封面图 URL
  isActive?: boolean; // 是否处于选中状态
  onClick?: (id: string) => void;
  className?: string; // 控制宽高等额外样式
  focusKey?: string;
}

import { FocusItem } from '../focus/FocusItem';

export const OreInstanceCard: React.FC<OreInstanceCardProps> = ({
  id,
  name,
  mcVersion,
  loaderType,
  lastPlayed,
  playTime,
  coverUrl,
  isActive = false,
  onClick,
  className = 'w-48 h-64', // 默认给一个竖向卡片的尺寸
  focusKey
}) => {
  const { t } = useTranslation();

  return (
    <FocusItem
      focusKey={focusKey}
      onEnter={() => onClick && onClick(id)}
    >
      {({ ref, focused, tabIndex }) => (
        <button
          ref={ref as any}
          onClick={() => onClick && onClick(id)}
          tabIndex={tabIndex}
          aria-label={`${name} - Minecraft ${mcVersion} ${loaderType}`}
          aria-pressed={isActive}
          className={`
            ore-instance-card focus:outline-none
            ${isActive ? 'active' : ''} 
            ${focused ? 'is-focused' : ''}
            ${className}
          `}
        >
          {/* ================= 第一段：上部封面图 ================= */}
          <div className="ore-instance-cover-wrapper flex-shrink-0 flex items-center justify-center overflow-hidden">
            {coverUrl ? (
              <img 
                src={coverUrl} 
                alt={name} 
                className="w-full h-full object-cover opacity-90 transition-opacity hover:opacity-100" 
                draggable={false}
              />
            ) : (
              // 没有封面时的占位图 (可以放个草方块图标或者简单的文字)
              <div className="text-ore-text-muted font-minecraft text-xl opacity-30">
                NO COVER
              </div>
            )}

            {/* 选中时，可以在封面图右下角叠一个小小的绿色对勾或播放图标 */}
            {isActive && (
              <div className="absolute bottom-1 right-1 bg-ore-green border border-ore-green-shadow p-0.5 shadow-md" aria-hidden="true">
                <Play size={12} fill="currentColor" className="text-white" />
              </div>
            )}
          </div>

          {/* ================= 第二段：南部实例信息 ================= */}
          <div className="flex-1 flex flex-col justify-center bg-[#2B2E33] px-3 py-2 w-full text-left">
            {/* 实例名称：大号字体，文字带阴影，超长截断 */}
            <span className="truncate font-minecraft text-white text-[15px] tracking-wide drop-shadow-md">
              {name}
            </span>
            
            {/* 版本与引导器、时间 */}
            <div className="mt-1.5 flex items-center space-x-2 truncate font-minecraft text-[10px] text-gray-300">
              <span className="bg-black/50 px-1.5 py-0.5 rounded-sm text-gray-300 border border-white/5 shadow-inner">
                {mcVersion}
              </span>

              {loaderType && loaderType.toLowerCase() !== 'vanilla' && (
                <span className="flex items-center gap-1 bg-black/50 px-1.5 py-0.5 rounded-sm text-gray-300 border border-white/5 shadow-inner">
                  <img 
                    src={new URL(`../../assets/icons/tags/loaders/${loaderType.toLowerCase()}.svg`, import.meta.url).href}
                    alt={loaderType}
                    className="w-3 h-3 opacity-80 invert brightness-0"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  {loaderType}
                </span>
              )}

              {playTime !== undefined && playTime > 0 ? (
                <>
                  <span className="opacity-30">|</span>
                  <span>{formatPlayTime(playTime, t)}</span>
                </>
              ) : lastPlayed && lastPlayed !== t('home.neverPlayed') ? (
                <>
                  <span className="opacity-30">|</span>
                  <span>{lastPlayed}</span>
                </>
              ) : null}
            </div>
          </div>
        </button>
      )}
    </FocusItem>
  );
};