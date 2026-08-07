import { useImperativeDialog } from '@astryxdesign/core/Dialog';
import FocusTrap from 'focus-trap-react';
import React, { type ReactNode, useMemo } from 'react';

type DialogOptions = Parameters<typeof useImperativeDialog>[0];

export function useA11yDialog(defaultOptions?: DialogOptions) {
  const dialog = useImperativeDialog(defaultOptions);

  const element = useMemo(() => (
    <FocusTrap 
      active={dialog.isOpen} 
      focusTrapOptions={{ fallbackFocus: () => document.body }}
    >
      <div style={{ display: 'contents' }}>
        {dialog.element}
      </div>
    </FocusTrap>
  ), [dialog.element, dialog.isOpen]);

  return useMemo(() => ({
    ...dialog,
    element,
    show: (content: ReactNode, options?: DialogOptions) => {
      // Dialog shell caps at ~75vh; without overflow on the body, tall forms
      // (e.g. Tambah Pengajuan Pinjaman) clip the submit button with no scroll.
      dialog.show(
        <div
          tabIndex={-1}
          style={{
            outline: 'none',
            maxHeight: 'min(70vh, 100%)',
            overflowY: 'auto',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {content}
        </div>,
        {
          maxHeight: '85vh',
          ...defaultOptions,
          ...options,
        }
      );
    }
  }), [dialog, element, defaultOptions]);
}
