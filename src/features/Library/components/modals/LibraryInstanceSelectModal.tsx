import React, { useEffect, useState } from 'react';
import { Check, Columns3, Loader2, Save } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { FocusBoundary } from '../../../../ui/focus/FocusBoundary';
import type { LibraryResourceViewModel } from '../../logic/libraryItems';

interface LibraryInstanceSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: LibraryResourceViewModel | null;
  onConfirm: (selectedInstanceIds: string[]) => void;
}

interface InstanceItem {
  id: string;
  name: string;
  version: string;
  loader: string;
  coverPath?: string;
}

export const LibraryInstanceSelectModal: React.FC<LibraryInstanceSelectModalProps> = ({
  isOpen,
  onClose,
  resource,
  onConfirm,
}) => {
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && resource) {
      void loadData();
    }
  }, [isOpen, resource]);

  const loadData = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      // 1. Load instances
      const list = await invoke<InstanceItem[]>('get_all_instances', { forceRefresh: false });
      setInstances(list);
      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
      setErrorMsg(`数据加载失败: ${String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (id: string) => {
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

  const handleSave = () => {
    onConfirm(Array.from(selectedIds));
    onClose();
  };

  const resourceTitle = resource?.title || '未命名资源';
  const typeText = resource?.type === 'shader' ? '光影' : '资源包';

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={`选择${typeText}应用实例`}
      defaultFocusKey="btn-instance-confirm"
      className="h-[min(38rem,calc(100vh-2rem))] w-[40rem] max-w-[calc(100vw-2rem)] border-[0.1875rem] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-modal-bg)] shadow-[var(--ore-shadow-modal-default)]"
      contentClassName="min-h-0 overflow-visible p-0 flex flex-col h-full bg-[var(--ore-color-background-surface-panel)]"
      actionsClassName="!justify-center py-4 bg-[var(--ore-color-background-surface-raised)] border-t-[3px] border-[var(--ore-color-border-primary-default)]"
      actions={
        <div className="w-full flex flex-col items-center">
          {errorMsg && (
            <div className="text-xs text-[var(--ore-color-text-danger-default)] px-4 font-minecraft text-center truncate max-w-full mb-3">
              ⚠️ {errorMsg}
            </div>
          )}
          <div className="flex items-center justify-center gap-4 w-full">
            <OreButton 
              focusKey="btn-instance-cancel" 
              variant="secondary" 
              onClick={onClose} 
              size="auto"
            >
              取消
            </OreButton>
            <OreButton
              focusKey="btn-instance-confirm"
              variant="primary"
              onClick={handleSave}
              disabled={isLoading || selectedIds.size === 0}
              size="auto"
            >
              <Save size={14} className="mr-2" />
              确认并去选择版本
            </OreButton>
          </div>
        </div>
      }
    >
      <div className="shrink-0 border-b-[3px] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] px-6 py-4 border-l-4 border-[var(--ore-color-background-success-default)]">
        <div className="flex items-center gap-3">
          <Columns3 size={20} className="text-[var(--ore-color-background-success-default)]" />
          <div>
            <div className="font-minecraft text-sm text-[var(--ore-color-text-primary-default)] font-bold tracking-wide">{resourceTitle}</div>
            <div className="text-xs text-[var(--ore-color-text-muted-default)] mt-1.5 leading-relaxed font-minecraft">
              选择把该{typeText}导入到下方的实例中，通过超轻量级链接技术以防占用过多空间。
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-[var(--ore-color-background-surface-deep)]">
        <OreOverlayScrollArea className="h-full">
          <div className="p-4 space-y-2">
            {isLoading ? (
              <div className="flex h-48 flex-col items-center justify-center text-sm text-[var(--ore-color-text-muted-default)] font-minecraft">
                <Loader2 className="animate-spin mb-3 text-[var(--ore-color-background-success-default)]" size={24} />
                正在加载实例列表...
              </div>
            ) : instances.length > 0 ? (
              instances.map((instance) => {
                const checked = selectedIds.has(instance.id);
                return (
                  <FocusItem
                    key={instance.id}
                    focusKey={`lib-instance-item-${instance.id}`}
                    onEnter={() => handleToggle(instance.id)}
                  >
                    {({ ref, focused }) => (
                      <div
                        ref={ref as React.RefObject<HTMLDivElement>}
                        className={`flex items-center justify-between border-2 p-3.5 cursor-pointer rounded-[2px] transition-all duration-75 select-none ${
                          checked
                            ? 'border-[var(--ore-color-background-success-default)] bg-[rgba(108,195,73,0.1)] text-[var(--ore-color-text-primary-default)]'
                            : 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] text-[var(--ore-color-text-muted-default)] hover:bg-[var(--ore-color-background-surface-hover)]'
                        } ${focused ? 'outline outline-[2px] outline-[var(--ore-focus-ringFallback)] outline-offset-1 z-10 scale-[1.01] shadow-[0_0_10px_var(--ore-focus-glow)] brightness-110' : ''}`}
                        onClick={() => handleToggle(instance.id)}
                      >
                        <div className="min-w-0 flex-1 flex items-center gap-3.5">
                          <div className="h-10 w-10 shrink-0 border border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-deep)] overflow-hidden rounded-[2px] shadow-inner flex items-center justify-center">
                            {instance.coverPath ? (
                              <img src={instance.coverPath} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="text-[11px] font-minecraft text-[var(--ore-color-text-success-default)] font-bold">
                                {instance.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-bold font-minecraft text-[var(--ore-color-text-primary-default)] text-sm tracking-wide">{instance.name}</div>
                            <div className="text-[10px] text-[var(--ore-color-text-muted-default)] mt-1 font-minecraft">
                              MC版本: <span className="text-[var(--ore-color-text-secondary-default)]">{instance.version}</span> | 加载器: <span className="text-[var(--ore-color-text-secondary-default)]">{instance.loader || 'Vanilla'}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center pl-3">
                          <div className={`w-5 h-5 flex items-center justify-center border-2 rounded-[2px] transition-all duration-100 ${
                            checked 
                              ? 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-success-default)]' 
                              : 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-deep)]'
                          }`}>
                            {checked && <Check size={12} className="text-black stroke-[3.5px]" />}
                          </div>
                        </div>
                      </div>
                    )}
                  </FocusItem>
                );
              })
            ) : (
              <div className="flex h-48 flex-col items-center justify-center text-sm text-[var(--ore-color-text-muted-default)] text-center p-6 border-2 border-dashed border-[var(--ore-color-border-primary-default)] rounded-[2px] font-minecraft">
                暂无可用游戏实例，请先在实例页创建实例。
              </div>
            )}
          </div>
        </OreOverlayScrollArea>
      </div>
    </OreModal>
  );
};
