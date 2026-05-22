import React, { useMemo, useState } from 'react';
import {
  HardDrive,
  Shirt,
  Download,
  Trash2,
  Clock,
  FileArchive,
  AlertCircle,
} from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import { FocusBoundary } from '../../../../../../ui/focus/FocusBoundary';
import { useLinearNavigation } from '../../../../../../ui/focus/useLinearNavigation';

interface WebDavManageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MockSaveBackup {
  id: string;
  worldName: string;
  folderName: string;
  mcVersion: string;
  loader: string;
  size: string;
  date: string;
}

interface MockSkinBackup {
  id: string;
  fileName: string;
  size: string;
  date: string;
}

// Mock Data
const mockSaves: MockSaveBackup[] = [
  {
    id: 'save-1',
    worldName: '我的世界 - 生存日记',
    folderName: 'Survival_World',
    mcVersion: '1.20.4',
    loader: 'Forge 49.0.22',
    size: '45.2 MB',
    date: '2026-05-20 18:32:10',
  },
  {
    id: 'save-2',
    worldName: '红石研究基地',
    folderName: 'Redstone_Lab',
    mcVersion: '1.20.1',
    loader: 'Fabric 0.15.3',
    size: '12.8 MB',
    date: '2026-05-18 14:05:42',
  },
  {
    id: 'save-3',
    worldName: '空岛挑战 Hardcore',
    folderName: 'Skyblock_HC',
    mcVersion: '1.19.2',
    loader: 'Vanilla',
    size: '8.4 MB',
    date: '2026-05-15 09:21:15',
  },
];

const mockSkins: MockSkinBackup[] = [
  {
    id: 'skin-1',
    fileName: 'Steve_Classic.png',
    size: '1.2 KB',
    date: '2026-05-10 12:00:00',
  },
  {
    id: 'skin-2',
    fileName: 'Alex_Slim_2026.png',
    size: '1.4 KB',
    date: '2026-05-11 15:30:22',
  },
  {
    id: 'skin-3',
    fileName: 'Enderman_Suit.png',
    size: '2.1 KB',
    date: '2026-05-22 22:45:10',
  },
];

export const WebDavManageModal: React.FC<WebDavManageModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'saves' | 'skins'>('saves');

  // Focus configuration
  const focusOrder = useMemo(() => {
    const tabKeys = ['webdav-manage-tab-saves', 'webdav-manage-tab-skins'];
    const itemKeys = activeTab === 'saves'
      ? mockSaves.flatMap(save => [
          `webdav-manage-download-${save.id}`,
          `webdav-manage-delete-${save.id}`,
        ])
      : mockSkins.map(skin => `webdav-manage-delete-${skin.id}`);

    return [...tabKeys, ...itemKeys, 'webdav-manage-close'];
  }, [activeTab]);

  const defaultFocusKey = focusOrder[0];
  const { handleLinearArrow } = useLinearNavigation(
    focusOrder,
    defaultFocusKey,
    false,
    isOpen
  );

  const handleActionClick = (actionType: 'download' | 'delete', name: string) => {
    alert(`【演示界面】已触发模拟操作：\n类型: ${actionType === 'download' ? '下载存档' : '删除备份'}\n目标: ${name}\n提示: 该界面暂无后端逻辑支持。`);
  };

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="管理 WebDAV 备份文件"
      defaultFocusKey={defaultFocusKey}
      className="w-[50rem] max-w-[calc(100vw-2rem)]"
      actions={(
        <div className="flex justify-end">
          <OreButton
            variant="secondary"
            onClick={onClose}
            focusKey="webdav-manage-close"
            onArrowPress={handleLinearArrow}
          >
            关闭
          </OreButton>
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        {/* Banner */}
        <div className="flex items-start gap-3 border-2 border-ore-green/30 bg-[#2b3528]/80 p-3 text-sm text-ore-text-muted">
          <AlertCircle size={18} className="text-ore-green shrink-0 mt-0.5" />
          <div>
            <div className="font-minecraft text-white font-bold mb-0.5">管理云端备份文件</div>
            <p className="text-xs text-[#B1B2B5]">
              这里显示保存在您 WebDAV 云盘上的所有备份记录。您可以将它们下载到本地或直接从云端删除。当前仅展示 UI 原型。
            </p>
          </div>
        </div>

        {/* Tab Header */}
        <div className="flex border-b-2 border-[#1E1E1F] bg-[#141517]">
          <OreButton
            variant={activeTab === 'saves' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('saves')}
            focusKey="webdav-manage-tab-saves"
            onArrowPress={handleLinearArrow}
            className="flex-1 !h-11 !min-h-11 justify-center rounded-none border-b-0"
          >
            <HardDrive size={16} className="mr-2" />
            游戏存档备份 ({mockSaves.length})
          </OreButton>
          <OreButton
            variant={activeTab === 'skins' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('skins')}
            focusKey="webdav-manage-tab-skins"
            onArrowPress={handleLinearArrow}
            className="flex-1 !h-11 !min-h-11 justify-center rounded-none border-b-0"
          >
            <Shirt size={16} className="mr-2" />
            皮肤文件备份 ({mockSkins.length})
          </OreButton>
        </div>

        {/* Content list */}
        <FocusBoundary
          id="webdav-manage-boundary"
          className="flex min-h-[16rem] max-h-[24rem] flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar"
        >
          {activeTab === 'saves' ? (
            mockSaves.map((save) => (
              <div
                key={save.id}
                className="flex items-center justify-between border-2 border-[#1E1E1F] bg-[#242526] p-3 hover:border-ore-green/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#1E1E1F] bg-black/20 text-[#5DADEC]">
                    <FileArchive size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-minecraft text-sm font-bold text-white truncate">
                      {save.worldName}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#B1B2B5]">
                      <span>版本: {save.mcVersion}</span>
                      <span>核心: {save.loader}</span>
                      <span>大小: {save.size}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {save.date}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <OreButton
                    variant="primary"
                    size="sm"
                    onClick={() => handleActionClick('download', save.worldName)}
                    focusKey={`webdav-manage-download-${save.id}`}
                    onArrowPress={handleLinearArrow}
                  >
                    <Download size={14} className="mr-1" />
                    下载
                  </OreButton>
                  <OreButton
                    variant="danger"
                    size="sm"
                    onClick={() => handleActionClick('delete', save.worldName)}
                    focusKey={`webdav-manage-delete-${save.id}`}
                    onArrowPress={handleLinearArrow}
                  >
                    <Trash2 size={14} className="mr-1" />
                    删除
                  </OreButton>
                </div>
              </div>
            ))
          ) : (
            mockSkins.map((skin) => (
              <div
                key={skin.id}
                className="flex items-center justify-between border-2 border-[#1E1E1F] bg-[#242526] p-3 hover:border-ore-green/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#1E1E1F] bg-black/20 text-[#6CC349]">
                    <Shirt size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-minecraft text-sm font-bold text-white truncate">
                      {skin.fileName}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#B1B2B5]">
                      <span>大小: {skin.size}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {skin.date}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <OreButton
                    variant="danger"
                    size="sm"
                    onClick={() => handleActionClick('delete', skin.fileName)}
                    focusKey={`webdav-manage-delete-${skin.id}`}
                    onArrowPress={handleLinearArrow}
                  >
                    <Trash2 size={14} className="mr-1" />
                    删除
                  </OreButton>
                </div>
              </div>
            ))
          )}
        </FocusBoundary>
      </div>
    </OreModal>
  );
};
