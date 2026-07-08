import { useImperativeDialog } from '@astryxdesign/core/Dialog';
import FocusTrap from 'focus-trap-react';
import React, { type ReactNode, useMemo } from 'react';

type DialogOptions = Parameters<typeof useImperativeDialog>[0];

export function useA11yDialog(defaultOptions?: DialogOptions) {
  const dialog = useImperativeDialog(defaultOptions);

  return useMemo(() => ({
    ...dialog,
    show: (content: ReactNode, options?: DialogOptions) => {
      dialog.show(
        <FocusTrap>
          <div tabIndex={-1} style={{ outline: 'none' }}>
            {content}
          </div>
        </FocusTrap>,
        options
      );
    }
  }), [dialog]);
}
