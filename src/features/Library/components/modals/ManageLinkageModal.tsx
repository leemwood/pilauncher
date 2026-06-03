import React, { useEffect, useState } from 'react';
import { Check, Columns3, Loader2, Save } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import type { LibraryResourceViewModel } from '../../logic/libraryItems';

interface ManageLinkageModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: LibraryResourceViewModel | null;
  onSuccess?: () => void;
}

interface InstanceItem {
  id: string;
  name: string;
  version: string;
  loader: string;
  coverPath?: string;
}

export const ManageLinkageModal: React.FC<ManageLinkageModalProps> = ({
  isOpen,
  onClose,
  resource,
  onSuccess,
}) => {

  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && resource) {
      void loadData();
    }
  }, [isOpen, resource]);

  const loadData = async () => {
    if (!resource) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Load instances
      const list = await invoke<InstanceItem[]>('get_all_instances', { forceRefresh: false });
      setInstances(list);

      // 2. Load linked instances
      const linkedIds = await invoke<string[]>('get_library_resource_mappings', {
        resourceId: resource.id,
      });
      setSelectedIds(new Set(linkedIds));
    } catch (e) {
      console.error(e);
      setErrorMsg(`数据加载失败: ${String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (id: string) => {
    if (isSaving) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!resource || isSaving) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await invoke('link_library_resource_to_instances', {
        resourceId: resource.id,
        instanceIds: Array.from(selectedIds),
      });
      onSuccess?.();
      onClose();
    } catch (e) {
      console.error(e);
      setErrorMsg(`保存失败: ${String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const resourceTitle = resource?.title || '未命名资源';
  const typeText = resource?.type === 'shader' ? '光影' : '资源包';

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={`管理${typeText}实例导入`}
      defaultFocusKey="btn-linkage-save"
      className="h-[min(38rem,calc(100vh-2rem))] w-[40rem] max-w-[calc(100vw-2rem)] border-[0.1875rem] border-[#1E1E1F] bg-[var(--ore-modal-bg)]"
      contentClassName="min-h-0 overflow-visible p-0 flex flex-col h-full bg-[#242526]"
      actions={
        <>
          {errorMsg && (
            <div className="mr-auto text-xs text-[#F46D6D] px-4 font-minecraft truncate max-w-[20rem]">
              {errorMsg}
            </div>
          )}
          <OreButton focusKey="btn-linkage-cancel" variant="secondary" onClick={onClose} disabled={isSaving}>
            取消
          </OreButton>
          <OreButton
            focusKey="btn-linkage-save"
            variant="primary"
            onClick={() => { void handleSave(); }}
            disabled={isLoading || isSaving}
          >
            {isSaving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
            保存映射
          </OreButton>
        </>
      }
    >
      <div className="shrink-0 border-b border-[#2D2E30] bg-[#1C1D1E] px-5 py-4">
        <div className="flex items-center gap-3">
          <Columns3 size={18} className="text-[#6CC349]" />
          <div>
            <div className="font-minecraft text-sm text-white font-bold">{resourceTitle}</div>
            <div className="text-xs text-[#8A8B8C] mt-0.5">选择把该{typeText}导入到下方的实例中，通过超轻量级链接技术以防占用过多空间。</div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-[#1A1A1B]">
        <OreOverlayScrollArea className="h-full">
          <div className="p-4 space-y-2">
            {isLoading ? (
              <div className="flex h-40 flex-col items-center justify-center text-sm text-[#B1B2B5]">
                <Loader2 className="animate-spin mb-2" />
                正在加载实例映射...
              </div>
            ) : instances.length > 0 ? (
              instances.map((instance) => {
                const checked = selectedIds.has(instance.id);
                return (
                  <div
                    key={instance.id}
                    className={`flex items-center justify-between border p-3 cursor-pointer ${
                      checked
                        ? 'border-[#6CC349] bg-[#6CC349]/10 text-white'
                        : 'border-[#2D2E30] bg-[#222324] text-[#D0D1D4] hover:bg-[#2A2B2C]'
                    }`}
                    onClick={() => handleToggle(instance.id)}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                      <div className="h-8 w-8 shrink-0 border border-[#1E1E1F] bg-[#313233] overflow-hidden">
                        {instance.coverPath ? (
                          <img src={instance.coverPath} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-bold font-minecraft text-white text-sm">{instance.name}</div>
                        <div className="text-[10px] text-[#8A8B8C] mt-0.5">
                          MC版本: {instance.version} | 加载器: {instance.loader || 'Vanilla'}
                        </div>
                      </div>
                    </div>
                    {checked && <Check size={18} className="text-[#6CC349] ml-2" />}
                  </div>
                );
              })
            ) : (
              <div className="flex h-40 flex-col items-center justify-center text-sm text-[#B1B2B5]">
                暂无可用游戏实例，请先在实例页创建实例。
              </div>
            )}
          </div>
        </OreOverlayScrollArea>
      </div>
    </OreModal>
  );
};
