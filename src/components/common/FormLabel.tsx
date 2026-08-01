import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';

export interface FormLabelProps {
  children: ReactNode;
  required?: boolean;
}

/**
 * Form label with optional required indicator.
 */
export function FormLabel({ children, required }: FormLabelProps) {
  return (
    <Text type="label">
      {children}
      {required && (
        <Text type="label" color="critical" style={{ marginLeft: 4 }}>
          *
        </Text>
      )}
    </Text>
  );
}
