import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';

export interface FormFieldErrorProps {
  children: ReactNode;
}

/**
 * Consistent error message display for form fields.
 * Uses semantic color from design system.
 */
export function FormFieldError({ children }: FormFieldErrorProps) {
  return (
    <Text type="supporting" color="critical">
      {children}
    </Text>
  );
}
