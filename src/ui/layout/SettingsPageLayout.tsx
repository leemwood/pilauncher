import React, { createContext, useRef, useMemo } from 'react';
import { OreOverlayScrollArea } from '../primitives/OreOverlayScrollArea';

interface SettingsPageLayoutProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  adaptiveScale?: boolean;
  width?: 'default' | 'wide' | 'full';
  /** When false, disables the outer scroll container so inner components (e.g. Virtuoso) can own scrolling. Default: true */
  scrollable?: boolean;
}

export const SettingsStaggerContext = createContext<{ getDelay: () => number } | null>(null);

export const SettingsPageLayout: React.FC<SettingsPageLayoutProps> = ({
  title,
  subtitle,
  children,
  className = '',
  adaptiveScale = false,
  width = 'default',
  scrollable = true
}) => {
  const widthClass = width === 'default' ? '' : `ore-settings-page-layout--${width}`;
  
  const rowCounterRef = useRef(0);
  rowCounterRef.current = 0;

  const contextValue = useMemo(() => ({
    getDelay: () => {
      const delay = rowCounterRef.current * 0.015; // 15ms stagger delay
      rowCounterRef.current += 1;
      return delay;
    }
  }), []);

  const content = (
    <SettingsStaggerContext.Provider value={contextValue}>
      <div className="ore-settings-page-layout__inner mx-auto w-full">
        {title && (
          <div className="ore-settings-page-layout__header">
            <h2 className="ore-settings-page-layout__title font-minecraft text-white ore-text-shadow">{title}</h2>
            {subtitle && (
              <p className="ore-settings-page-layout__subtitle font-minecraft text-ore-text-muted tracking-widest uppercase">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div className="ore-settings-page-layout__content">
          {children}
        </div>
      </div>
    </SettingsStaggerContext.Provider>
  );

  if (scrollable) {
    return (
      <OreOverlayScrollArea
        className={`ore-settings-page-layout ${widthClass} w-full h-full ${
          adaptiveScale ? 'ore-settings-scale-adaptive' : ''
        } ${className}`}
      >
        {content}
      </OreOverlayScrollArea>
    );
  }

  return (
    <div
      className={`ore-settings-page-layout ${widthClass} w-full h-full ore-settings-page-layout--no-scroll overflow-hidden ${
        adaptiveScale ? 'ore-settings-scale-adaptive' : ''
      } ${className}`}
    >
      {content}
    </div>
  );
};
