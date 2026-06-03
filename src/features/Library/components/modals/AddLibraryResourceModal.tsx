import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
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
      className="h-[min(48rem,calc(100vh-2rem))] w-[46rem] max-w-[calc(100vw-2rem)]"
      contentClassName="min-h-0 overflow-visible p-0 flex flex-col h-full bg-[var(--ore-color-background-surface-panel)]"
      actions={
        <>
          {importError && (
            <div className="mr-auto text-[length:var(--ore-typography-size-caption)] text-[#F46D6D] px-4 font-minecraft truncate max-w-[20rem]">
              {importError}
            </div>
          )}
          <OreButton focusKey="btn-add-close" variant="secondary" onClick={onClose} disabled={isImporting}>
            取消
          </OreButton>
          <OreButton
            focusKey="btn-local-import-start"
            variant="primary"
            onClick={() => { void handleImportLocal(); }}
            disabled={isImporting || !localPath || !localTitle.trim()}
          >
            {isImporting ? <Loader2 className="animate-spin mr-2" size={14} /> : <Upload size={14} className="mr-2" />}
            开始导入
          </OreButton>
        </>
      }
    >
      {/* Redirection Banner for Online collections */}
      <div className="shrink-0 border-b-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] px-6 py-3 flex justify-between items-center text-[length:var(--ore-typography-size-caption)] text-[var(--ore-color-text-muted-default)]">
        <div className="flex items-center gap-1.5">
          <span>💡 想要在线收藏？您可以直接前往</span>
          <button
            type="button"
            onClick={() => {
              setActiveTab('downloads');
              onClose();
            }}
            className="text-[#6CC349] hover:underline font-bold font-minecraft flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 outline-none inline-block align-baseline"
          >
            资源下载页 <ArrowLeft size={12} className="rotate-180" />
          </button>
          <span>浏览检索并一键收藏。</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-[var(--ore-color-background-surface-panel)]">
        <OreOverlayScrollArea className="h-full">
          <div className="p-6 space-y-5 text-[var(--ore-color-text-secondary-default)] text-[length:var(--ore-typography-size-sm)]">
            {/* Drag and Drop Container */}
            <div
              className={`border-2 border-dashed rounded p-8 flex flex-col items-center justify-center transition-all ${
                dragActive
                  ? 'border-[#6CC349] bg-[#6CC349]/5'
                  : 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-deep)] hover:border-[var(--ore-color-border-primary-strong)]'
              }`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <Upload size={32} className={`mb-3 ${dragActive ? 'text-[#6CC349]' : 'text-[var(--ore-color-text-muted-default)]'}`} />
              <div className="text-[length:var(--ore-typography-size-sm)] font-bold text-white mb-1">
                拖拽文件到此处，或
                <button
                  type="button"
                  onClick={() => { void handleBrowseLocal(); }}
                  className="text-[#6CC349] hover:underline ml-1 font-bold cursor-pointer bg-transparent border-none p-0 outline-none inline-block align-baseline"
                >
                  浏览本地文件
                </button>
              </div>
              <div className="text-[length:var(--ore-typography-size-caption)] text-[var(--ore-color-text-muted-default)]">支持 .zip 文件压缩包或文件夹</div>
            </div>

            <div className="flex justify-between items-center border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] px-4 py-3">
              <span className="text-[length:var(--ore-typography-size-sm)] text-[var(--ore-color-text-secondary-default)]">导入文件夹结构包（非压缩包）</span>
              <input
                type="checkbox"
                checked={isLocalFolder}
                onChange={(e) => {
                  setIsLocalFolder(e.target.checked);
                  setLocalPath('');
                  setLocalTitle('');
                }}
                disabled={isImporting}
                className="accent-[#6CC349] cursor-pointer h-4 w-4"
              />
            </div>

            {localPath && (
              <div className="border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] p-3 rounded">
                <div className="text-[length:var(--ore-typography-size-caption)] text-[var(--ore-color-text-muted-default)] mb-1 font-minecraft">选定路径</div>
                <div className="text-[length:var(--ore-typography-size-caption)] text-white font-mono break-all">{localPath}</div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <div className="mb-1 text-[length:var(--ore-typography-size-caption)] text-[var(--ore-color-text-muted-default)] font-minecraft">收藏标题 (必填)</div>
                <OreInput
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  placeholder="输入收藏标题"
                  disabled={isImporting}
                  focusKey="input-add-local-title"
                />
              </div>
              <div>
                <div className="mb-1 text-[length:var(--ore-typography-size-caption)] text-[var(--ore-color-text-muted-default)] font-minecraft">版本号</div>
                <OreInput
                  value={localVersion}
                  onChange={(e) => setLocalVersion(e.target.value)}
                  placeholder="例如: 1.0.0"
                  disabled={isImporting}
                  focusKey="input-add-local-version"
                />
              </div>
            </div>

            {/* 作者和描述输入框已移除 */}

            {/* Tag Checklist */}
            {tagCollections.length > 0 && (
              <div className="border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] p-4 space-y-3">
                <div className="text-[length:var(--ore-typography-size-caption)] text-[var(--ore-color-text-muted-default)] font-minecraft text-center">
                  关联标签 (选择“光影”或“资源包”系统标签会自动识别对应类型进行底层处理)
                </div>
                <div className="flex flex-wrap gap-3 justify-center">
                  {tagCollections.map((tag) => {
                    const checked = selectedTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleToggleTag(tag.id)}
                        className={`px-4 py-2 border-2 text-[length:var(--ore-typography-size-sm)] font-minecraft font-bold transition-all cursor-pointer rounded-[2px] ${
                          checked
                            ? 'border-[#6CC349] bg-[#6CC349]/15 text-[#6CC349]'
                            : 'border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] text-[var(--ore-color-text-muted-default)] hover:border-white hover:text-white'
                        }`}
                      >
                        {tag.name}
                      </button>
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
