import React, { useEffect, useState } from 'react';
import { FolderOpen, Loader2, Save } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import { OreModal } from '../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../ui/primitives/OreInput';
import type { LibraryResourceViewModel } from '../../logic/libraryItems';

interface EditLibraryResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: LibraryResourceViewModel | null;
  onSuccess?: () => void;
}

export const EditLibraryResourceModal: React.FC<EditLibraryResourceModalProps> = ({
  isOpen,
  onClose,
  resource,
  onSuccess,
}) => {

  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [author, setAuthor] = useState('');
  const [desc, setDesc] = useState('');
  const [fileName, setFileName] = useState('');

  // --- Upgrade/Overwrite path ---
  const [newLocalPath, setNewLocalPath] = useState('');
  const [isLocalFolder, setIsLocalFolder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && resource) {
      setTitle(resource.title || '');
      setVersion(resource.version || '');
      setAuthor(resource.author || '');
      setDesc(resource.description || '');

      try {
        const snapshot = JSON.parse(resource.item.snapshot);
        setFileName(snapshot.fileName || '');
      } catch {
        setFileName('');
      }

      setNewLocalPath('');
      setIsLocalFolder(false);
      setErrorMsg(null);
    }
  }, [isOpen, resource]);

  const handleBrowseLocal = async () => {
    try {
      const typeText = resource?.type === 'shader' ? '光影' : '资源包';
      const selected = await openDialog({
        multiple: false,
        directory: isLocalFolder,
        filters: isLocalFolder ? undefined : [{ name: typeText, extensions: ['zip'] }],
      });

      if (selected && typeof selected === 'string') {
        setNewLocalPath(selected);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!resource || isSaving) return;
    if (!title.trim()) {
      setErrorMsg('标题不能为空');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const updatedFileName = newLocalPath ? (newLocalPath.split(/[/\\]/).pop() || '') : fileName;
      const snapshotObj = {
        title: title.trim(),
        author: author.trim(),
        description: desc.trim(),
        version: version.trim(),
        fileName: updatedFileName,
        iconUrl: resource.iconUrl,
        loaders: resource.loaders,
        categories: resource.categories,
      };

      if (newLocalPath) {
        // Upgrade flow: overwrite file and recreate link maps
        await invoke('update_library_resource_file', {
          resourceId: resource.id,
          newLocalPath: newLocalPath,
          newFilename: updatedFileName,
          newSnapshotJson: JSON.stringify(snapshotObj),
        });
      } else {
        // Simple metadata update
        const updatedItem = {
          ...resource.item,
          title: title.trim(),
          author: author.trim() || undefined,
          snapshot: JSON.stringify(snapshotObj),
          updatedAt: Math.floor(Date.now() / 1000),
        };
        await invoke('save_starred_item', {
          item: updatedItem,
          deviceId: '', // optional or empty
        });
      }

      onSuccess?.();
      onClose();
    } catch (e) {
      console.error(e);
      setErrorMsg(`更新失败: ${String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const typeText = resource?.type === 'shader' ? '光影' : '资源包';

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={`编辑与覆盖升级${typeText}`}
      defaultFocusKey="btn-edit-res-save"
      className="h-[min(44rem,calc(100vh-2rem))] w-[46rem] max-w-[calc(100vw-2rem)] border-[0.1875rem] border-[#1E1E1F] bg-[var(--ore-modal-bg)]"
      contentClassName="min-h-0 overflow-visible p-5 flex flex-col h-full bg-[#242526] space-y-4 font-sans text-white text-sm"
      actions={
        <>
          {errorMsg && (
            <div className="mr-auto text-xs text-[#F46D6D] px-4 font-minecraft truncate max-w-[20rem]">
              {errorMsg}
            </div>
          )}
          <OreButton focusKey="btn-edit-res-cancel" variant="secondary" onClick={onClose} disabled={isSaving}>
            取消
          </OreButton>
          <OreButton
            focusKey="btn-edit-res-save"
            variant="primary"
            onClick={() => { void handleSave(); }}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
            保存更新
          </OreButton>
        </>
      }
    >
      <div className="border border-[#2D2E30] bg-[#1A1A1B] p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-1 text-xs text-[#B1B2B5]">标题 (必填)</div>
            <OreInput value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSaving} focusKey="edit-res-title" />
          </div>
          <div>
            <div className="mb-1 text-xs text-[#B1B2B5]">版本号</div>
            <OreInput value={version} onChange={(e) => setVersion(e.target.value)} disabled={isSaving} focusKey="edit-res-version" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-1 text-xs text-[#B1B2B5]">作者</div>
            <OreInput value={author} onChange={(e) => setAuthor(e.target.value)} disabled={isSaving} focusKey="edit-res-author" />
          </div>
          <div>
            <div className="mb-1 text-xs text-[#B1B2B5]">描述 / 备注</div>
            <OreInput value={desc} onChange={(e) => setDesc(e.target.value)} disabled={isSaving} focusKey="edit-res-desc" />
          </div>
        </div>
      </div>

      <div className="border border-[#2D2E30] bg-[#1A1A1B] p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="font-minecraft text-xs text-[#B1B2B5]">覆盖升级 (可选)</div>
          <label className="flex items-center gap-1.5 text-xs text-[#D0D1D4] cursor-pointer">
            <input
              type="checkbox"
              checked={isLocalFolder}
              onChange={(e) => {
                setIsLocalFolder(e.target.checked);
                setNewLocalPath('');
              }}
              disabled={isSaving}
              className="accent-[#6CC349]"
            />
            导入文件夹结构
          </label>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <OreInput
              value={newLocalPath}
              onChange={(e) => setNewLocalPath(e.target.value)}
              placeholder="留空表示仅更新基础元数据；选择新文件则覆盖库文件并重构软链接"
              readOnly
              focusKey="edit-res-new-path"
            />
          </div>
          <OreButton focusKey="btn-edit-res-browse" variant="secondary" onClick={handleBrowseLocal} disabled={isSaving}>
            <FolderOpen size={16} className="mr-2" />
            浏览新文件
          </OreButton>
        </div>
        {fileName && (
          <div className="text-[10px] text-[#8A8B8C] font-mono">
            当前库文件名: {fileName}
          </div>
        )}
      </div>
    </OreModal>
  );
};
