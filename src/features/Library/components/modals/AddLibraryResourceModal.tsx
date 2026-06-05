import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Upload, Sparkles, Package } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { OreSwitch } from '../../../../ui/primitives/OreSwitch';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useLibraryStore } from '../../../../stores/useLibraryStore';
import { useLauncherStore } from '../../../../store/useLauncherStore';

interface AddLibraryResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddLibraryResourceModal: React.FC<AddLibraryResourceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { addItemToCollection } = useLibraryStore();
  const setActiveTab = useLauncherStore((state) => state.setActiveTab);

  // --- Local Import State ---
  const [localPath, setLocalPath] = useState('');
  const [isLocalFolder, setIsLocalFolder] = useState(false);
  const [localTitle, setLocalTitle] = useState('');
  const [localVersion, setLocalVersion] = useState('1.0.0');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // --- Drag and Drop State ---
  const [dragActive, setDragActive] = useState(false);

  // --- Tags State ---
  const collections = useLibraryStore((state) => state.collections);
  const tagCollections = useMemo(
    () => collections.filter((c) => c.type === 'group'),
    [collections]
  );
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  // Automatically check default tags based on filenames or start fresh
  useEffect(() => {
    if (isOpen) {
      setLocalPath('');
      setIsLocalFolder(false);
      setLocalTitle('');
      setLocalVersion('1.0.0');
      setImportError(null);
      setIsImporting(false);
      setSelectedTagIds(new Set());
    }
  }, [isOpen]);

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const path = (file as any).path || '';
      if (path) {
        setLocalPath(path);
        const name = path.split(/[/\\]/).pop() || '';
        const cleanName = name.replace(/\.zip$/i, '');
        setLocalTitle(cleanName);
        
        // Auto-tag detect based on keywords
        const lowerName = cleanName.toLowerCase();
        const autoChecked = new Set<string>();
        if (lowerName.includes('shader') || lowerName.includes('光影') || lowerName.includes('chocapic') || lowerName.includes('bsl') || lowerName.includes('complementary')) {
          const shaderTag = tagCollections.find(c => c.name === '光影');
          if (shaderTag) autoChecked.add(shaderTag.id);
        } else if (lowerName.includes('resource') || lowerName.includes('pack') || lowerName.includes('资源包') || lowerName.includes('材质')) {
          const packTag = tagCollections.find(c => c.name === '资源包');
          if (packTag) autoChecked.add(packTag.id);
        }
        if (autoChecked.size > 0) {
          setSelectedTagIds(autoChecked);
        }
      }
    }
  };

  const handleBrowseLocal = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        directory: isLocalFolder,
        filters: isLocalFolder ? undefined : [{ name: '压缩包', extensions: ['zip'] }],
      });

      if (selected && typeof selected === 'string') {
        setLocalPath(selected);
        const name = selected.split(/[/\\]/).pop() || '';
        const cleanName = isLocalFolder ? name : name.replace(/\.zip$/i, '');
        setLocalTitle(cleanName);

        // Auto-tag detect based on keywords
        const lowerName = cleanName.toLowerCase();
        const autoChecked = new Set<string>();
        if (lowerName.includes('shader') || lowerName.includes('光影') || lowerName.includes('chocapic') || lowerName.includes('bsl') || lowerName.includes('complementary')) {
          const shaderTag = tagCollections.find(c => c.name === '光影');
          if (shaderTag) autoChecked.add(shaderTag.id);
        } else if (lowerName.includes('resource') || lowerName.includes('pack') || lowerName.includes('资源包') || lowerName.includes('材质')) {
          const packTag = tagCollections.find(c => c.name === '资源包');
          if (packTag) autoChecked.add(packTag.id);
        }
        if (autoChecked.size > 0) {
          setSelectedTagIds(autoChecked);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportLocal = async () => {
    if (!localPath || !localTitle.trim()) {
      setImportError('请选择导入文件并填写标题');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    const now = Math.floor(Date.now() / 1000);
    const fileName = localPath.split(/[/\\]/).pop() || '';
    const itemId = `local:${fileName.replace(/\./g, '_')}_${now}`;

    // Determine type based on tags
    let determinedType = 'resourcepack';
    if (selectedTagIds.has('tag-shaders')) {
      determinedType = 'shader';
    } else if (selectedTagIds.has('tag-resourcepacks')) {
      determinedType = 'resourcepack';
    }

    const starredItem = {
      id: itemId,
      type: determinedType,
      source: 'custom',
      projectId: itemId,
      title: localTitle.trim(),
      author: '本地导入',
      snapshot: JSON.stringify({
        title: localTitle.trim(),
        author: '本地导入',
        description: '',
        version: localVersion.trim(),
        fileName: fileName,
        loaders: [],
        categories: ['Local'],
      }),
      state: JSON.stringify({
        installedVersion: localVersion.trim(),
        hasUpdate: false,
      }),
      meta: JSON.stringify({
        createdAt: now,
        updatedAt: now,
      }),
      createdAt: now,
      updatedAt: now,
    };

    try {
      await invoke('import_local_resource_to_library', {
        resType: determinedType,
        localPath,
        starredItem,
      });

      // Bind all checked tags
      for (const tagId of selectedTagIds) {
        const colItem = {
          id: `${tagId}:${starredItem.id}`,
          collectionId: tagId,
          itemId: starredItem.id,
          position: 0,
          createdAt: now,
        };
        await addItemToCollection(colItem);
      }

      onSuccess?.();
      onClose();
    } catch (e) {
      console.error(e);
      setImportError(`导入失败: ${String(e)}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="本地导入收藏"
      defaultFocusKey="btn-add-close"
      className="h-[min(48rem,80vh)] w-[46rem] max-w-[calc(100vw-2rem)] border-[0.1875rem] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-modal-bg)] shadow-[var(--ore-shadow-modal-default)]"
      contentClassName="min-h-0 overflow-visible p-0 flex flex-col h-full bg-[var(--ore-color-background-surface-panel)]"
      actionsClassName="!justify-center py-4 bg-[var(--ore-color-background-surface-raised)] border-t-[3px] border-[var(--ore-color-border-primary-default)]"
      actions={
        <div className="w-full flex flex-col items-center">
          {importError && (
            <div className="text-xs text-[var(--ore-color-text-danger-default)] px-4 font-minecraft text-center truncate max-w-full mb-3">
              ⚠️ {importError}
            </div>
          )}
          <div className="flex items-center justify-center gap-4 w-full">
            <OreButton 
              focusKey="btn-add-close" 
              variant="secondary" 
              onClick={onClose} 
              disabled={isImporting} 
              size="auto"
            >
              取消
            </OreButton>
            <OreButton
              focusKey="btn-local-import-start"
              variant="primary"
              onClick={() => { void handleImportLocal(); }}
              disabled={isImporting || !localPath || !localTitle.trim()}
              size="auto"
            >
              {isImporting ? <Loader2 className="animate-spin mr-2" size={14} /> : <Upload size={14} className="mr-2" />}
              开始导入
            </OreButton>
          </div>
        </div>
      }
    >
      {/* Redirection Banner for Online collections */}
      <div className="shrink-0 border-b-[3px] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] px-6 py-3.5 flex justify-between items-center text-xs text-[var(--ore-color-text-primary-default)]">
        <div className="flex items-center gap-3.5 bg-[var(--ore-color-background-warning-subtle)] border-2 border-[var(--ore-color-border-warning-subtle)] px-5 py-3 rounded-sm w-full shadow-[inset_0_-2px_rgba(0,0,0,0.2)]">
          <span className="text-[#f5c542] text-base shrink-0 select-none">💡</span>
          <span className="font-minecraft text-[12px] text-[var(--ore-color-text-warning-strong)] leading-relaxed flex-1">
            想要在线收藏？可以直接前往{" "}
            <button
              type="button"
              onClick={() => {
                setActiveTab('downloads');
                onClose();
              }}
              className="text-[var(--ore-color-text-success-soft)] hover:text-white font-bold border-b border-dashed border-[var(--ore-color-text-success-soft)] hover:border-solid pb-0.5 cursor-pointer bg-transparent p-0 outline-none inline-block align-baseline transition-all"
            >
              资源下载页
            </button>{" "}
            &rarr; 浏览检索并一键收藏。
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-[var(--ore-color-background-surface-deep)]">
        <OreOverlayScrollArea className="h-full">
          <div className="p-6 space-y-6 text-[var(--ore-color-text-primary-default)] text-sm">
            {/* Drag and Drop Container */}
            <FocusItem
              focusKey="btn-browse-drag-drop"
              onEnter={() => { void handleBrowseLocal(); }}
            >
              {({ ref, focused }) => (
                <div
                  ref={ref as React.RefObject<HTMLDivElement>}
                  className={`border-2 border-dashed p-8 flex flex-col items-center justify-center transition-all duration-150 select-none cursor-pointer rounded-sm ${
                    dragActive
                      ? 'border-[var(--ore-color-background-success-default)] bg-[rgba(108,195,73,0.05)]'
                      : 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] hover:border-white/50 hover:bg-[var(--ore-color-background-surface-hover)]'
                  } ${focused ? 'outline outline-[2px] outline-[var(--ore-focus-ringFallback)] outline-offset-1 scale-[1.01] shadow-[0_0_10px_var(--ore-focus-glow)] z-10 brightness-110' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => { void handleBrowseLocal(); }}
                >
                  <div className={`p-4 rounded-full bg-[var(--ore-color-background-surface-deep)] border border-[var(--ore-color-border-primary-default)] mb-3 transition-colors ${dragActive ? 'border-[var(--ore-color-background-success-default)]' : ''}`}>
                    <Upload size={28} className={dragActive ? 'text-[var(--ore-color-background-success-default)]' : 'text-[var(--ore-color-text-muted-default)]'} />
                  </div>
                  <div className="text-sm font-bold text-white mb-1.5 font-minecraft">
                    拖拽文件到此处，或 <span className="text-[var(--ore-color-text-success-default)] font-bold hover:underline">浏览本地文件</span>
                  </div>
                  <div className="text-xs text-[var(--ore-color-text-muted-default)] font-minecraft">支持 .zip 文件压缩包或文件夹</div>
                </div>
              )}
            </FocusItem>

            {localPath && (
              <div className="border-[3px] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] p-4 rounded-sm space-y-2">
                <div className="text-[10px] text-[var(--ore-color-text-muted-default)] font-minecraft uppercase tracking-wider">选定路径</div>
                <div className="text-xs text-[var(--ore-color-background-info-default)] font-mono break-all bg-[var(--ore-color-background-surface-deep)] p-3 rounded-sm border border-[var(--ore-color-border-primary-default)]">{localPath}</div>
              </div>
            )}

            {/* Form grid: Title + Version + Folder Switch on the same line */}
            <div className="grid grid-cols-1 md:grid-cols-[3fr_1.5fr_auto] gap-5 items-end bg-[var(--ore-color-background-surface-panel)] border-[3px] border-[var(--ore-color-border-primary-default)] p-5 rounded-sm shadow-[var(--ore-shadow-input-default)]">
              <div className="w-full">
                <OreInput
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  placeholder="输入收藏标题"
                  disabled={isImporting}
                  focusKey="input-add-local-title"
                  label="收藏标题 (必填)"
                />
              </div>
              <div className="w-full">
                <OreInput
                  value={localVersion}
                  onChange={(e) => setLocalVersion(e.target.value)}
                  placeholder="例如: 1.0.0"
                  disabled={isImporting}
                  focusKey="input-add-local-version"
                  label="版本号"
                />
              </div>
              <div className="flex flex-col items-center shrink-0 min-w-[7.5rem] pb-0.5">
                <span className="text-xs font-minecraft font-bold ore-text-shadow text-[var(--ore-color-text-muted-default)] mb-2.5 select-none text-center">
                  导入为文件夹
                </span>
                <OreSwitch
                  checked={isLocalFolder}
                  onChange={(checked) => {
                    setIsLocalFolder(checked);
                    setLocalPath('');
                    setLocalTitle('');
                  }}
                  disabled={isImporting}
                  focusKey="switch-add-local-folder"
                />
              </div>
            </div>

            {/* Tag Selection block */}
            {tagCollections.length > 0 && (
              <div className="border-[3px] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] p-5 rounded-sm space-y-4 text-center">
                <div className="text-xs text-[var(--ore-color-text-muted-default)] font-minecraft leading-relaxed">
                  关联标签 (选择“光影”或“资源包”系统标签会自动识别对应类型进行底层处理)
                </div>
                <div className="flex flex-wrap gap-4 justify-center">
                  {tagCollections.map((tag) => {
                    const checked = selectedTagIds.has(tag.id);
                    const isShader = tag.name.includes('光影') || tag.id.includes('shaders');
                    
                    return (
                      <FocusItem
                        key={tag.id}
                        focusKey={`btn-tag-${tag.id}`}
                        onEnter={() => handleToggleTag(tag.id)}
                      >
                        {({ ref, focused }) => (
                          <button
                            ref={ref as React.RefObject<HTMLButtonElement>}
                            type="button"
                            onClick={() => handleToggleTag(tag.id)}
                            className={`
                              relative flex items-center justify-center min-w-[9.5rem] h-10 px-5 border-2 text-sm font-minecraft font-bold tracking-wide transition-all duration-75 cursor-pointer rounded-sm select-none
                              ${checked
                                ? isShader
                                  ? 'border-[#1E1E1F] bg-[#3C8527] text-white shadow-[inset_0_-4px_#1D4D13,inset_2px_2px_rgba(255,255,255,0.2),inset_-2px_-6px_rgba(0,0,0,0.15)] pb-[5px] pt-[1px]'
                                  : 'border-[#1E1E1F] bg-[#2E6BE5] text-white shadow-[inset_0_-4px_#1b3b80,inset_2px_2px_rgba(255,255,255,0.25),inset_-2px_-6px_rgba(0,0,0,0.15)] pb-[5px] pt-[1px]'
                                : 'border-[#1E1E1F] bg-[#48494A] text-[var(--ore-color-text-muted-default)] hover:text-white shadow-[inset_0_-4px_#313233,inset_2px_2px_rgba(255,255,255,0.1),inset_-2px_-6px_rgba(0,0,0,0.2)] hover:bg-[#535456] pb-[5px] pt-[1px]'
                              }
                              ${focused
                                ? 'outline outline-[2px] outline-[var(--ore-focus-ringFallback)] outline-offset-1 z-10 scale-[1.03] brightness-110 drop-shadow-[0_0_6px_var(--ore-focus-glow)]'
                                : ''
                              }
                            `}
                          >
                            {isShader ? (
                              <Sparkles size={15} className={`mr-2.5 shrink-0 ${checked ? 'text-[#FFE866]' : 'text-gray-400'}`} />
                            ) : (
                              <Package size={15} className={`mr-2.5 shrink-0 ${checked ? 'text-[#8CB3FF]' : 'text-gray-400'}`} />
                            )}
                            {tag.name}
                          </button>
                        )}
                      </FocusItem>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </OreOverlayScrollArea>
      </div>
    </OreModal>
  );
};
