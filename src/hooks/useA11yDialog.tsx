import { useImperativeDialog } from '@astryxdesign/core/Dialog';
import FocusTrap from 'focus-trap-react';
import React, { type ReactNode, useMemo } from 'react';

type DialogOptions = Parameters<typeof useImperativeDialog>[0];

export function useA11yDialog(defaultOptions?: DialogOptions) {
  const dialog = useImperativeDialog(defaultOptions);

  const element = useMemo(() => (
    <FocusTrap active={dialog.isOpen}>
      <div style={{ display: 'contents' }}>
        {dialog.element}
      </div>
    </FocusTrap>
  ), [dialog.element, dialog.isOpen]);

  return useMemo(() => ({
    ...dialog,
    element,
    show: (content: ReactNode, options?: DialogOptions) => {
      dialog.show(
        <div tabIndex={-1} style={{ outline: 'none' }}>
          {content}
        </div>,
        options
      );
    }
  }), [dialog, element]);
}
