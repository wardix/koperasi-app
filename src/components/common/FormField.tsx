import { VStack } from '@astryxdesign/core/Layout';
import { TextInput } from '@astryxdesign/core/TextInput';
import type { TextInputProps } from '@astryxdesign/core/TextInput';
import { Text } from '@astryxdesign/core/Text';
import { FormLabel } from './FormLabel';
import { FormFieldError } from './FormFieldError';

export interface FormFieldProps extends Omit<TextInputProps, 'label'> {
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
}

/**
 * Reusable form field with label, input, description, and error display.
 * Integrates with react-hook-form and Astryx design system.
 */
export function FormField({
  label,
  error,
  required,
  description,
  ...inputProps
}: FormFieldProps) {
  return (
    <VStack gap={1}>
      <FormLabel required={required}>{label}</FormLabel>
      <TextInput {...inputProps} />
      {description && !error && (
        <Text type="supporting" color="secondary">
          {description}
        </Text>
      )}
      {error && <FormFieldError>{error}</FormFieldError>}
    </VStack>
  );
}
