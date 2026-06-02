import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, AlertTriangle, Search, Keyboard, RotateCw, CheckCircle2 } from 'lucide-react';

import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreOverlayScrollArea } from '../../../../ui/primitives/OreOverlayScrollArea';
import { useToastStore } from '../../../../store/useToastStore';

// standard keybind name map
const STANDARD_KEYBINDS: Record<string, { zh: string; en: string }> = {
  "key.forward": { zh: "向前移动", en: "Move Forward" },
  "key.left": { zh: "向左移动", en: "Move Left" },
  "key.back": { zh: "向后移动", en: "Move Backward" },
  "key.right": { zh: "向右移动", en: "Move Right" },
  "key.jump": { zh: "跳跃", en: "Jump" },
  "key.sneak": { zh: "潜行", en: "Sneak" },
  "key.sprint": { zh: "疾跑", en: "Sprint" },
  "key.drop": { zh: "丢弃物品", en: "Drop Item" },
  "key.inventory": { zh: "打开/关闭背包", en: "Open/Close Inventory" },
  "key.chat": { zh: "打开聊天栏", en: "Open Chat" },
  "key.playerlist": { zh: "显示玩家列表", en: "List Players" },
  "key.screenshot": { zh: "截图", en: "Take Screenshot" },
  "key.togglePerspective": { zh: "切换视角", en: "Toggle Perspective" },
  "key.smoothCamera": { zh: "电影级摄像机", en: "Cinematic Camera" },
  "key.swapHands": { zh: "副手物品交换", en: "Swap Item In Hands" },
  "key.use": { zh: "使用物品/放置方块", en: "Use Item/Place Block" },
  "key.attack": { zh: "攻击/毁坏", en: "Attack/Destroy" },
  "key.pickItem": { zh: "选取方块", en: "Pick Block" },
  "key.fullscreen": { zh: "切换全屏", en: "Toggle Fullscreen" },
  "key.spectatorOutlines": { zh: "高亮显示玩家 (旁观)", en: "Highlight Players (Spectator)" },
  "key.hotbar.1": { zh: "快捷栏第1格", en: "Hotbar Slot 1" },
  "key.hotbar.2": { zh: "快捷栏第2格", en: "Hotbar Slot 2" },
  "key.hotbar.3": { zh: "快捷栏第3格", en: "Hotbar Slot 3" },
  "key.hotbar.4": { zh: "快捷栏第4格", en: "Hotbar Slot 4" },
  "key.hotbar.5": { zh: "快捷栏第5格", en: "Hotbar Slot 5" },
  "key.hotbar.6": { zh: "快捷栏第6格", en: "Hotbar Slot 6" },
  "key.hotbar.7": { zh: "快捷栏第7格", en: "Hotbar Slot 7" },
  "key.hotbar.8": { zh: "快捷栏第8格", en: "Hotbar Slot 8" },
  "key.hotbar.9": { zh: "快捷栏第9格", en: "Hotbar Slot 9" },
  "key.saveToolbarActivator": { zh: "保存快捷栏激活键", en: "Save Toolbar Activator" },
  "key.loadToolbarActivator": { zh: "加载快捷栏激活键", en: "Load Toolbar Activator" },
  "key.advancements": { zh: "打开进度界面", en: "Advancements" },
  "key.command": { zh: "打开命令栏", en: "Open Command" },
  "key.socialInteractions": { zh: "多人联机社交交互", en: "Social Interactions Screen" },
};

const FRIENDLY_KEYS: Record<string, { zh: string; en: string }> = {
  "key.mouse.left": { zh: "鼠标左键", en: "Left Click" },
  "key.mouse.right": { zh: "鼠标右键", en: "Right Click" },
  "key.mouse.middle": { zh: "鼠标中键", en: "Middle Click" },
  "key.keyboard.space": { zh: "空格键", en: "Space" },
  "key.keyboard.left.shift": { zh: "左 Shift", en: "LShift" },
  "key.keyboard.right.shift": { zh: "右 Shift", en: "RShift" },
  "key.keyboard.left.control": { zh: "左 Ctrl", en: "LCtrl" },
  "key.keyboard.right.control": { zh: "右 Ctrl", en: "RCtrl" },
  "key.keyboard.left.alt": { zh: "左 Alt", en: "LAlt" },
  "key.keyboard.right.alt": { zh: "右 Alt", en: "RAlt" },
  "key.keyboard.escape": { zh: "Esc", en: "Esc" },
  "key.keyboard.enter": { zh: "回车键", en: "Enter" },
  "key.keyboard.tab": { zh: "Tab 键", en: "Tab" },
  "key.keyboard.backspace": { zh: "退格键", en: "Backspace" },
  "key.keyboard.caps.lock": { zh: "大写锁定", en: "Caps Lock" },
  "key.keyboard.num.lock": { zh: "数字锁定", en: "Num Lock" },
  "key.keyboard.scroll.lock": { zh: "滚动锁定", en: "Scroll Lock" },
  "key.keyboard.up": { zh: "方向键上", en: "Up Arrow" },
  "key.keyboard.down": { zh: "方向键下", en: "Down Arrow" },
  "key.keyboard.left": { zh: "方向键左", en: "Left Arrow" },
  "key.keyboard.right": { zh: "方向键右", en: "Right Arrow" },
};

const LWJGL_KEYS: Record<string, string> = {
  "1": "Esc", "2": "1", "3": "2", "4": "3", "5": "4", "6": "5", "7": "6", "8": "7", "9": "8", "10": "9", "11": "0",
  "12": "-", "13": "=", "14": "Backspace", "15": "Tab", "16": "Q", "17": "W", "18": "E", "19": "R", "20": "T", "21": "Y",
  "22": "U", "23": "I", "24": "O", "25": "P", "26": "[", "27": "]", "28": "Enter", "29": "LCtrl", "30": "A", "31": "S",
  "32": "D", "33": "F", "34": "G", "35": "H", "36": "J", "37": "K", "38": "L", "39": ";", "40": "'", "41": "`",
  "42": "LShift", "43": "\\", "44": "Z", "45": "X", "46": "C", "47": "V", "48": "B", "49": "N", "50": "M", "51": ",",
  "52": ".", "53": "/", "54": "RShift", "56": "LAlt", "57": "Space", "58": "Caps Lock",
  "200": "Up", "203": "Left", "205": "Right", "208": "Down",
};

interface KeyBind {
  name: string;
  key: string;
}

interface KeymapSectionProps {
  instanceId: string;
}

const mapEventCodeToMcKey = (code: string): string => {
  if (code.startsWith("Key")) {
    return `key.keyboard.${code.substring(3).toLowerCase()}`;
  }
  if (code.startsWith("Digit")) {
    return `key.keyboard.${code.substring(5)}`;
  }
  if (code.startsWith("Numpad") && code.length === 7) {
    return `key.keyboard.keypad.${code.substring(6)}`;
  }
  switch (code) {
    case "Space": return "key.keyboard.space";
    case "ShiftLeft": return "key.keyboard.left.shift";
    case "ShiftRight": return "key.keyboard.right.shift";
    case "ControlLeft": return "key.keyboard.left.control";
    case "ControlRight": return "key.keyboard.right.control";
    case "AltLeft": return "key.keyboard.left.alt";
    case "AltRight": return "key.keyboard.right.alt";
    case "Escape": return "key.keyboard.escape";
    case "Enter": return "key.keyboard.enter";
    case "Tab": return "key.keyboard.tab";
    case "Backspace": return "key.keyboard.backspace";
    case "CapsLock": return "key.keyboard.caps.lock";
    case "ArrowUp": return "key.keyboard.up";
    case "ArrowDown": return "key.keyboard.down";
    case "ArrowLeft": return "key.keyboard.left";
    case "ArrowRight": return "key.keyboard.right";
    case "F1": return "key.keyboard.f1";
    case "F2": return "key.keyboard.f2";
    case "F3": return "key.keyboard.f3";
    case "F4": return "key.keyboard.f4";
    case "F5": return "key.keyboard.f5";
    case "F6": return "key.keyboard.f6";
    case "F7": return "key.keyboard.f7";
    case "F8": return "key.keyboard.f8";
    case "F9": return "key.keyboard.f9";
    case "F10": return "key.keyboard.f10";
    case "F11": return "key.keyboard.f11";
    case "F12": return "key.keyboard.f12";
    default:
      return `key.keyboard.${code.toLowerCase()}`;
  }
};

export const KeymapSection: React.FC<KeymapSectionProps> = ({ instanceId }) => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const addToast = useToastStore((s) => s.addToast);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [keybindings, setKeybindings] = useState<KeyBind[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit State
  const [editingBind, setEditingBind] = useState<KeyBind | null>(null);

  const loadKeybindings = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const data = await invoke<KeyBind[]>('get_instance_keybindings', { instanceId });
      setKeybindings(data);
    } catch (err: any) {
      if (err === 'OPTIONS_TXT_NOT_FOUND') {
        setNotFound(true);
      } else {
        console.error('获取按键配置失败:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadKeybindings();
  }, [instanceId]);

  const handleInitializeDefault = async () => {
    setLoading(true);
    try {
      await invoke('initialize_default_keybindings', { instanceId });
      addToast('success', t('instanceDetail.game.successInit', '默认按键初始化成功'), 2400);
      void loadKeybindings();
    } catch (err) {
      console.error('初始化按键配置失败:', err);
      setLoading(false);
    }
  };

  const handleResetToDefault = async () => {
    setSaving(true);
    try {
      await invoke('initialize_default_keybindings', { instanceId });
      addToast('success', t('instanceDetail.game.successInit', '默认按键已恢复为默认设置'), 2400);
      void loadKeybindings();
    } catch (err) {
      console.error('恢复默认按键配置失败:', err);
    } finally {
      setSaving(false);
    }
  };

  // Conflict calculation
  const conflictCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const kb of keybindings) {
      if (kb.key && kb.key !== 'key.keyboard.none' && kb.key !== '0') {
        counts[kb.key] = (counts[kb.key] || 0) + 1;
      }
    }
    return counts;
  }, [keybindings]);

  // Display name helper
  const getActionDisplayName = (actionName: string): string => {
    const std = STANDARD_KEYBINDS[actionName];
    if (std) {
      return isZh ? std.zh : std.en;
    }
    return actionName;
  };

  const getFriendlyKeyName = (keyVal: string): string => {
    if (!keyVal) return "-";
    if (FRIENDLY_KEYS[keyVal]) {
      return isZh ? FRIENDLY_KEYS[keyVal].zh : FRIENDLY_KEYS[keyVal].en;
    }
    if (keyVal.startsWith("key.keyboard.")) {
      const rawName = keyVal.replace("key.keyboard.", "");
      return rawName.toUpperCase();
    }
    if (LWJGL_KEYS[keyVal]) {
      return LWJGL_KEYS[keyVal];
    }
    return keyVal;
  };

  // Filtered Keybinds
  const filteredKeybindings = useMemo(() => {
    if (!searchQuery.trim()) return keybindings;
    const query = searchQuery.toLowerCase().trim();
    return keybindings.filter((kb) => {
      const dispName = getActionDisplayName(kb.name).toLowerCase();
      const rawName = kb.name.toLowerCase();
      const keyFriendly = getFriendlyKeyName(kb.key).toLowerCase();
      const keyRaw = kb.key.toLowerCase();
      return dispName.includes(query) || rawName.includes(query) || keyFriendly.includes(query) || keyRaw.includes(query);
    });
  }, [keybindings, searchQuery, isZh]);

  // Save specific keybind
  const saveKeybind = async (name: string, newKey: string) => {
    setSaving(true);
    const updated = keybindings.map((kb) => {
      if (kb.name === name) {
        return { ...kb, key: newKey };
      }
      return kb;
    });

    try {
      await invoke('save_instance_keybindings', { instanceId, keybindings: updated });
      setKeybindings(updated);
      addToast('success', t('instanceDetail.game.successSave', '按键已保存'), 2000);
    } catch (err) {
      console.error('保存按键失败:', err);
    } finally {
      setSaving(false);
    }
  };

  // Global keydown capture while editing
  useEffect(() => {
    if (!editingBind) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const mcKey = mapEventCodeToMcKey(e.code);
      void saveKeybind(editingBind.name, mcKey);
      setEditingBind(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [editingBind]);

  const bindMouse = (mouseKey: string) => {
    if (!editingBind) return;
    void saveKeybind(editingBind.name, mouseKey);
    setEditingBind(null);
  };

  if (loading) {
    return (
      <SettingsSection title={t('instanceDetail.game.keymapTitle', '按键布局管理')} icon={<Keyboard size="1.125rem" />}>
        <div className="flex h-40 items-center justify-center text-ore-text-muted">
          <Loader2 size="1.5rem" className="animate-spin mr-2" />
          <span>正在加载配置文件...</span>
        </div>
      </SettingsSection>
    );
  }

  if (notFound) {
    return (
      <SettingsSection title={t('instanceDetail.game.keymapTitle', '按键布局管理')} icon={<Keyboard size="1.125rem" />}>
        <div className="border-2 border-dashed border-ore-gray-border bg-[#1E1E1F]/50 p-6 flex flex-col items-center justify-center text-center font-minecraft rounded-[2px]">
          <AlertTriangle size="2rem" className="text-ore-gold mb-3 animate-bounce" />
          <h4 className="text-lg text-white mb-1">{t('instanceDetail.game.keyNotFound', '未找到配置文件')}</h4>
          <p className="text-sm text-ore-text-muted max-w-md mb-4">
            {t('instanceDetail.game.keyNotFoundDesc', '未检测到 options.txt 配置文件，可能因为该实例尚未运行过。您可以初始化一个默认按键布局。')}
          </p>
          <OreButton
            focusKey="keybind-btn-init"
            variant="primary"
            onClick={handleInitializeDefault}
          >
            {t('instanceDetail.game.initDefault', '初始化默认按键')}
          </OreButton>
        </div>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title={t('instanceDetail.game.keymapTitle', '按键布局管理')} icon={<Keyboard size="1.125rem" />}>
      <div className="flex flex-col w-full font-minecraft relative">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex-1 min-w-[15rem] relative">
            <Search size="1rem" className="absolute left-3 top-1/2 -translate-y-1/2 text-ore-text-muted pointer-events-none" />
            <input
              type="text"
              placeholder={t('instanceDetail.game.searchPlaceholder', '搜索按键名称、键名或描述...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141415] border-2 border-ore-gray-border hover:border-white/50 focus:border-ore-green px-10 py-2 text-sm text-white outline-none rounded-[2px] transition-all"
            />
          </div>
          
          <div className="flex items-center gap-3">
              <OreButton
                focusKey="keybind-btn-reset"
                variant="secondary"
                onClick={handleResetToDefault}
                disabled={saving}
                className="flex items-center gap-1.5"
              >
                <RotateCw size="0.875rem" className={saving ? 'animate-spin' : ''} />
                {t('instanceDetail.game.resetBtn', '恢复默认按键')}
              </OreButton>
          </div>
        </div>

        {/* Bindings List */}
        <div className="border-2 border-ore-gray-border bg-[#141415] rounded-[2px] overflow-hidden flex flex-col h-[28rem]">
          <div className="grid grid-cols-[1.5fr_1.2fr_0.8fr] bg-[#1E1E1F] border-b-2 border-ore-gray-border px-4 py-2.5 text-xs uppercase tracking-[0.08em] text-ore-text-muted select-none">
            <div>动作</div>
            <div>映射按键</div>
            <div className="text-right">状态</div>
          </div>

          <OreOverlayScrollArea className="flex-1 min-h-0" contentClassName="divide-y-2 divide-ore-gray-border/40">
            {filteredKeybindings.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-center text-sm text-ore-text-muted">
                {t('libraryPage.empty.noMatchTitle', '没有匹配项目')}
              </div>
            ) : (
              filteredKeybindings.map((kb) => {
                const isConflicting = (conflictCountMap[kb.key] || 0) > 1;
                return (
                  <FocusItem
                    key={kb.name}
                    focusKey={`keybind-item-${kb.name}`}
                    onEnter={() => setEditingBind(kb)}
                  >
                    {({ ref, focused }) => (
                      <div
                        ref={ref as any}
                        onClick={() => setEditingBind(kb)}
                        className={`grid grid-cols-[1.5fr_1.2fr_0.8fr] items-center px-4 py-3 cursor-pointer select-none transition-all outline-none border-2 border-transparent ${
                          focused
                            ? 'bg-ore-green/10 border-ore-focus drop-shadow-ore-glow'
                            : 'hover:bg-white/5'
                        }`}
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-sm font-bold text-white truncate">{getActionDisplayName(kb.name)}</span>
                          <span className="text-[0.625rem] text-ore-text-muted truncate mt-0.5">{kb.name}</span>
                        </div>

                        <div className="text-sm font-minecraft text-ore-green truncate">
                          {getFriendlyKeyName(kb.key)}
                        </div>

                        <div className="flex justify-end items-center">
                          {isConflicting ? (
                            <span className="inline-flex items-center gap-1 bg-[#3A1414] border border-[#ff4d4d]/30 text-[#ff4d4d] px-2 py-0.5 rounded-[2px] text-[0.625rem] font-bold">
                              <AlertTriangle size="0.675rem" />
                              {t('instanceDetail.game.conflict', '冲突')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-[#23301F] border border-ore-green/30 text-ore-green px-2 py-0.5 rounded-[2px] text-[0.625rem] font-bold">
                              <CheckCircle2 size="0.675rem" />
                              {t('instanceDetail.game.noConflict', '正常')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </FocusItem>
                );
              })
            )}
          </OreOverlayScrollArea>
        </div>
      </div>

      {/* Editing Dialog Modal */}
      {editingBind && (
        <OreModal
          isOpen={true}
          onClose={() => setEditingBind(null)}
          title={t('instanceDetail.game.editBtn', '更改按键绑定')}
          className="w-[min(26rem,94vw)] z-[9999]"
          contentClassName="p-6 text-center font-minecraft"
          actions={
            <div className="flex w-full flex-col gap-2">
              <div className="grid grid-cols-3 gap-2">
                <OreButton
                  focusKey="mouse-btn-left"
                  variant="secondary"
                  onClick={() => bindMouse('key.mouse.left')}
                  className="w-full text-xs"
                >
                  {t('instanceDetail.game.mouseLeft', '鼠标左键')}
                </OreButton>
                <OreButton
                  focusKey="mouse-btn-right"
                  variant="secondary"
                  onClick={() => bindMouse('key.mouse.right')}
                  className="w-full text-xs"
                >
                  {t('instanceDetail.game.mouseRight', '鼠标右键')}
                </OreButton>
                <OreButton
                  focusKey="mouse-btn-middle"
                  variant="secondary"
                  onClick={() => bindMouse('key.mouse.middle')}
                  className="w-full text-xs"
                >
                  {t('instanceDetail.game.mouseMiddle', '鼠标中键')}
                </OreButton>
              </div>
              <OreButton
                focusKey="edit-btn-cancel"
                variant="primary"
                onClick={() => setEditingBind(null)}
                className="w-full mt-2"
              >
                {t('common.cancel', '取消')}
              </OreButton>
            </div>
          }
        >
          <div className="flex flex-col items-center justify-center py-4 select-none">
            <Keyboard size="3rem" className="text-ore-green mb-4 animate-pulse" />
            <h4 className="text-base text-white font-bold mb-2">
              {getActionDisplayName(editingBind.name)}
            </h4>
            <p className="text-sm text-ore-text-muted mb-6">
              {t('instanceDetail.game.pressKey', '请按下一个按键...')}
            </p>
            <div className="text-xs text-[#8e8e93] px-3 py-1 bg-black/20 rounded-[2px]">
              {t('instanceDetail.game.pressKeyDesc', '按下键盘上的按键，或点击下方按钮绑定鼠标。')}
            </div>
          </div>
        </OreModal>
      )}
    </SettingsSection>
  );
};
