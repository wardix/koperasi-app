import React, { useState } from 'react';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { useToast } from '@astryxdesign/core/Toast';
import { DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline';

export interface CopyableAccountNumberProps {
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  showHolder?: boolean;
}

export function CopyableAccountNumber({
  bankName,
  accountNumber,
  accountHolder,
  showHolder = true,
}: CopyableAccountNumberProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  if (!accountNumber && !bankName) {
    return <Text type="supporting" color="secondary">-</Text>;
  }

  const cleanNumber = (accountNumber || '').trim();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!cleanNumber) return;

    // Only copy clean digits/account number
    const toCopy = cleanNumber.replace(/\s+/g, '');
    let success = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(toCopy);
        success = true;
      }
    } catch {
      // Fallback below
    }

    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = toCopy;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopied(true);
      try {
        toast({
          body: `Nomor rekening ${toCopy} disalin!`,
          type: 'info',
        });
      } catch {
        // toast context optional
      }
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <VStack gap={0}>
      <HStack vAlign="center" gap={1} wrap="nowrap">
        <span
          onClick={handleCopy}
          title={cleanNumber ? 'Klik untuk salin nomor rekening' : undefined}
          style={{
            cursor: cleanNumber ? 'pointer' : 'default',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            userSelect: 'all',
          }}
        >
          <Text type="body" weight="medium">
            {bankName ? `${bankName} — ` : ''}{cleanNumber || '-'}
          </Text>
        </span>
        {cleanNumber && (
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? 'Tersalin!' : 'Salin nomor rekening'}
            aria-label="Salin nomor rekening"
            style={{
              background: copied ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: copied ? 'var(--color-success-600, #16a34a)' : 'var(--color-text-secondary, #6b7280)',
              transition: 'all 0.15s ease',
              marginLeft: '2px',
            }}
          >
            {copied ? (
              <CheckIcon style={{ width: '14px', height: '14px', strokeWidth: 2.5 }} />
            ) : (
              <DocumentDuplicateIcon style={{ width: '14px', height: '14px' }} />
            )}
          </button>
        )}
      </HStack>
      {showHolder && accountHolder && (
        <Text type="supporting" color="secondary">
          a.n. {accountHolder}
        </Text>
      )}
    </VStack>
  );
}
