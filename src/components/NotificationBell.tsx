import React, { useState } from 'react';
import { Popover } from '@astryxdesign/core/Popover';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { Icon } from '@astryxdesign/core/Icon';
import { Heading, Text } from '@astryxdesign/core/Text';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import {
  BellIcon,
  BellAlertIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { PendingActionsData, PendingActionDetailItem } from '../../shared/types';
import { formatDate } from '../utils/format';

interface NotificationBellProps {
  pendingActions: PendingActionsData | null;
  onNavigate: (path: string) => void;
  onRefresh?: () => void;
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} mnt lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays === 1) return 'Kemarin';
  if (diffDays < 7) return `${diffDays} hari lalu`;
  return formatDate(dateString);
}

function getItemIcon(category: PendingActionDetailItem['category']) {
  switch (category) {
    case 'loan':
      return ClipboardDocumentCheckIcon;
    case 'ewa':
      return BanknotesIcon;
    case 'savings_deposit':
      return ArrowDownTrayIcon;
    case 'savings_withdrawal':
      return ArrowUpTrayIcon;
    case 'feedback':
      return ChatBubbleLeftRightIcon;
    case 'overdue_loan':
      return ExclamationTriangleIcon;
    default:
      return BellIcon;
  }
}

function getItemColors(severity: PendingActionDetailItem['severity']) {
  switch (severity) {
    case 'critical':
      return {
        bg: 'rgba(239, 68, 68, 0.1)',
        color: 'var(--color-critical-500, #ef4444)',
        border: 'rgba(239, 68, 68, 0.2)',
      };
    case 'warning':
      return {
        bg: 'rgba(245, 158, 11, 0.1)',
        color: 'var(--color-warning-500, #f59e0b)',
        border: 'rgba(245, 158, 11, 0.2)',
      };
    case 'info':
    default:
      return {
        bg: 'rgba(59, 130, 246, 0.1)',
        color: 'var(--color-primary-500, #3b82f6)',
        border: 'rgba(59, 130, 246, 0.2)',
      };
  }
}

export function NotificationBell({
  pendingActions,
  onNavigate,
  onRefresh,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalPending = pendingActions?.totalPending ?? 0;
  const overdueCount = pendingActions?.overdueLoansCount ?? 0;
  const totalCount = totalPending + overdueCount;
  const hasCritical = (pendingActions?.pendingLoans ?? 0) > 0 || overdueCount > 0;
  const items = pendingActions?.items ?? [];

  const handleItemClick = (route: string) => {
    setIsOpen(false);
    onNavigate(route);
  };

  const categories = [
    { label: 'Pinjaman', count: pendingActions?.pendingLoans ?? 0, route: '/loans', variant: 'critical' as const },
    { label: 'EWA', count: pendingActions?.pendingEwa ?? 0, route: '/ewa', variant: 'warning' as const },
    {
      label: 'Simpanan',
      count: (pendingActions?.pendingSavingsDeposits ?? 0) + (pendingActions?.pendingSavingsWithdrawals ?? 0),
      route: '/savings',
      variant: 'warning' as const,
    },
    { label: 'Masukan', count: pendingActions?.openFeedbacks ?? 0, route: '/feedbacks', variant: 'info' as const },
    { label: 'Jatuh Tempo', count: overdueCount, route: '/npl', variant: 'critical' as const },
  ].filter((c) => c.count > 0);

  const popoverContent = (
    <div
      style={{
        width: '380px',
        maxWidth: 'calc(100vw - 24px)',
        backgroundColor: 'var(--color-background-primary, #ffffff)',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        border: '1px solid var(--color-border-primary, rgba(0, 0, 0, 0.1))',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--color-border-primary, rgba(0, 0, 0, 0.08))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <HStack gap={2} vAlign="center">
          <Icon icon={BellIcon} size="sm" />
          <Heading level={4}>Pemberitahuan Tugas</Heading>
        </HStack>
        <HStack gap={2} vAlign="center">
          {totalCount > 0 ? (
            <Badge
              variant={hasCritical ? 'critical' : 'warning'}
              size="sm"
              label={`${totalCount} Menunggu`}
            />
          ) : (
            <Badge variant="success" size="sm" label="Semua Tertangani" />
          )}
          {onRefresh && (
            <IconButton
              label="Perbarui Data"
              variant="ghost"
              icon={<Icon icon={ArrowPathIcon} size="xsm" />}
              onClick={() => onRefresh()}
            />
          )}
        </HStack>
      </div>

      {/* Category Quick Chips */}
      {categories.length > 0 && (
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--color-background-secondary, rgba(0, 0, 0, 0.02))',
            borderBottom: '1px solid var(--color-border-primary, rgba(0, 0, 0, 0.06))',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => handleItemClick(cat.route)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              <Badge variant={cat.variant} size="sm" label={`${cat.label}: ${cat.count}`} />
            </button>
          ))}
        </div>
      )}

      {/* Body List */}
      <div
        style={{
          maxHeight: '320px',
          overflowY: 'auto',
        }}
      >
        {totalCount === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Icon icon={CheckCircleIcon} size="lg" color="success" />
            <Heading level={4}>Semua Antrean Bersih</Heading>
            <Text type="supporting" color="secondary" align="center">
              Tidak ada permohonan anggota atau cicilan jatuh tempo yang memerlukan perhatian pengurus saat ini.
            </Text>
          </div>
        ) : (
          <div>
            {items.map((item) => {
              const ItemIcon = getItemIcon(item.category);
              const colors = getItemColors(item.severity);
              const timeAgo = formatRelativeTime(item.date);

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item.route)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleItemClick(item.route);
                    }
                  }}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--color-border-primary, rgba(0, 0, 0, 0.05))',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      'var(--color-background-secondary, rgba(0, 0, 0, 0.04))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: colors.bg,
                      color: colors.color,
                      border: `1px solid ${colors.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    <Icon icon={ItemIcon} size="sm" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: '6px',
                      }}
                    >
                      <Text type="body" weight="bold" maxLines={1}>
                        {item.title}
                      </Text>
                      {timeAgo && (
                        <Text type="supporting" color="secondary" style={{ fontSize: '11px', flexShrink: 0 }}>
                          {timeAgo}
                        </Text>
                      )}
                    </div>
                    <Text type="supporting" color="secondary" maxLines={1}>
                      {item.subtitle}
                    </Text>
                  </div>
                  <div style={{ alignSelf: 'center', flexShrink: 0, opacity: 0.5 }}>
                    <Icon icon={ArrowRightIcon} size="xsm" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--color-border-primary, rgba(0, 0, 0, 0.08))',
          backgroundColor: 'var(--color-background-secondary, rgba(0, 0, 0, 0.02))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text type="supporting" color="secondary">
          Pusat Tugas Pengurus
        </Text>
        <Button
          label="Buka Dasbor"
          size="sm"
          variant="secondary"
          endContent={<Icon icon={ArrowRightIcon} size="xsm" />}
          onClick={() => handleItemClick('/')}
        />
      </div>
    </div>
  );

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="below"
      alignment="end"
      width="auto"
      label="Pemberitahuan Tugas Pengurus"
      content={popoverContent}
    >
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <IconButton
          label={
            totalCount > 0
              ? `Pemberitahuan: ${totalCount} tugas memerlukan tindak lanjut`
              : 'Pemberitahuan Tugas'
          }
          icon={
            <Icon
              icon={totalCount > 0 ? BellAlertIcon : BellIcon}
              size="sm"
              style={
                totalCount > 0
                  ? { color: hasCritical ? 'var(--color-critical-500, #ef4444)' : 'var(--color-warning-500, #f59e0b)' }
                  : undefined
              }
            />
          }
          variant="ghost"
        />
        {totalCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: '16px',
              height: '16px',
              padding: '0 4px',
              borderRadius: '8px',
              backgroundColor: hasCritical
                ? 'var(--color-critical-500, #ef4444)'
                : 'var(--color-warning-500, #f59e0b)',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              lineHeight: 1,
              boxShadow: '0 0 0 2px var(--color-background-primary, #ffffff)',
            }}
          >
            {totalCount > 99 ? '99+' : totalCount}
          </span>
        )}
      </div>
    </Popover>
  );
}
