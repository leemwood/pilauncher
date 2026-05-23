// /src/features/Download/components/DetailModal/ModpackCreateModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { PackagePlus } from 'lucide-react';

import { OreInput } from '../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type { OreProjectVersion, ModrinthProject } from '../../../InstanceDetail/logic/modrinthApi';

interface ModpackCreateModalProps {
  isOpen: boolean;
  version: OreProjectVersion | null;
  project: ModrinthProject | null;
  onClose: () => void;
  onConfirm: (instanceName: string) => void;
}

const NAME_INPUT_FOCUS_KEY = 'modpack-create-name-input';
const CANCEL_BUTTON_FOCUS_KEY = 'modpack-create-cancel';
const CONFIRM_BUTTON_FOCUS_KEY = 'modpack-create-confirm';

export const ModpackCreateModal: React.FC<ModpackCreateModalProps> = ({
  isOpen,
  version,
  project,
  onClose,
  onConfirm
}) => {
  const [instanceName, setInstanceName] = useState('');
  const lastFocusBeforeModalRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !project) return;

    const currentFocus = getCurrentFocusKey();
    if (currentFocus && currentFocus !== 'SN:ROOT') {
      lastFocusBeforeModalRef.current = currentFocus;
    }

    setInstanceName(project.title);
  }, [isOpen, project]);

  const restorePreviousFocus = () => {
    const lastFocus = lastFocusBeforeModalRef.current;
    if (lastFocus && doesFocusableExist(lastFocus)) {
      setFocus(lastFocus);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(restorePreviousFocus, 50);
  };

  const handleConfirm = () => {
    onConfirm(instanceName.trim() || project?.title || '');
  };

  if (!isOpen || !version || !project) return null;

  return (
    <OreModal
      isOpen={isOpen}
      onClose={handleClose}
      hideTitleBar={true}
      defaultFocusKey={NAME_INPUT_FOCUS_KEY}
      className="w-[44rem] max-w-[calc(100vw-2rem)] border-[0.1875rem] border-[#1E1E1F] bg-[var(--ore-modal-bg)] sm:max-w-[calc(100vw-3rem)]"
      contentClassName="flex flex-col overflow-hidden p-0"
    >
      <div className="flex-shrink-0 border-b-[0.1875rem] border-[#1E1E1F] bg-[#48494A] p-[1.25rem] font-minecraft text-[0.875rem] text-[#D0D1D4] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.16)]">
        <div className="mb-[0.25rem] flex items-center font-minecraft text-[1.125rem] font-bold leading-[1.35] text-white">
          <PackagePlus size={20} className="mr-2 text-[#6CC349]" />
          创建整合包实例
        </div>
        <div className="mt-2 text-xs text-[#D0D1D4]">
          准备下载：<span className="font-bold text-[#6CC349]">{version.file_name}</span>
        </div>
        <div className="mt-1 text-xs text-[#B1B2B5]">
          依赖环境：Minecraft {version.game_versions.join(', ')} | {version.loaders.join(', ')}
        </div>
      </div>

      <div className="flex-1 bg-[#313233] p-[1.25rem]">
        <div className="flex flex-col space-y-2">
          <label className="text-sm font-bold tracking-wider text-ore-text-muted">
            实例名称（支持自定义）
          </label>
          <OreInput
            focusKey={NAME_INPUT_FOCUS_KEY}
            value={instanceName}
            onChange={(event) => setInstanceName(event.target.value)}
            placeholder="输入实例名称"
            className="bg-black/50 border-[#2A2A2C] text-white font-minecraft focus:border-ore-green/50"
            onArrowPress={(direction) => {
              if (direction === 'down') {
                setFocus(CONFIRM_BUTTON_FOCUS_KEY);
                return false;
              }
              return true;
            }}
          />
        </div>
      </div>

      <div className="flex flex-shrink-0 justify-end gap-[1rem] border-t-[0.1875rem] border-[#1E1E1F] bg-[#48494A] p-[1rem] shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.14)]">
        <OreButton
          focusKey={CANCEL_BUTTON_FOCUS_KEY}
          variant="secondary"
          onClick={handleClose}
          onArrowPress={(direction) => {
            if (direction === 'up') {
              setFocus(NAME_INPUT_FOCUS_KEY);
              return false;
            }
            if (direction === 'right') {
              setFocus(CONFIRM_BUTTON_FOCUS_KEY);
              return false;
            }
            return true;
          }}
        >
          取消
        </OreButton>
        <OreButton
          focusKey={CONFIRM_BUTTON_FOCUS_KEY}
          variant="primary"
          disabled={!instanceName.trim()}
          onClick={handleConfirm}
          onArrowPress={(direction) => {
            if (direction === 'up') {
              setFocus(NAME_INPUT_FOCUS_KEY);
              return false;
            }
            if (direction === 'left') {
              setFocus(CANCEL_BUTTON_FOCUS_KEY);
              return false;
            }
            return true;
          }}
        >
          开始下载与部署
        </OreButton>
      </div>
    </OreModal>
  );
};
