import React, { useState } from 'react';
import { ChatBubbleLeftRightIcon, CameraIcon } from '@heroicons/react/24/outline';
import { FeedbackDialog } from './FeedbackDialog';

export const FeedbackWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const captureCurrentScreen = async (): Promise<string | null> => {
    // Helper to sanitize the cloned document before html2canvas parses styles
    const sanitizeClone = (clonedDoc: Document) => {
      try {
        // Remove ignored nodes (widget triggers, dialogs, cross-origin iframes, videos)
        clonedDoc
          .querySelectorAll(
            '[data-feedback-ignore="true"], [data-html2canvas-ignore="true"], iframe, video, audio, #credential_picker_container, #credential_picker_iframe'
          )
          .forEach((el) => {
            el.remove();
          });

        const isDark =
          document.documentElement.classList.contains('dark') ||
          document.body.classList.contains('dark');

        // Sanitize modern CSS functions (light-dark, oklch, color-mix) in all style tags
        clonedDoc.querySelectorAll('style').forEach((st) => {
          if (
            st.textContent &&
            (st.textContent.includes('oklch') ||
              st.textContent.includes('light-dark') ||
              st.textContent.includes('color-mix'))
          ) {
            st.textContent = st.textContent
              .replace(/light-dark\(([^,]+),\s*([^)]+)\)/g, isDark ? '$2' : '$1')
              .replace(/oklch\([^)]+\)/g, 'rgba(0, 0, 0, 0.12)')
              .replace(/color-mix\([^)]+\)/g, 'rgba(0, 0, 0, 0.12)');
          }
        });

        // Neutralize box-shadow and text-shadow in cloned document to avoid
        // unsupported color function parser errors in html2canvas (e.g. Astryx elevation shadows)
        const overrideStyle = clonedDoc.createElement('style');
        overrideStyle.setAttribute('type', 'text/css');
        overrideStyle.textContent = `
          *, *::before, *::after {
            box-shadow: none !important;
            text-shadow: none !important;
          }
        `;
        clonedDoc.head.appendChild(overrideStyle);
      } catch (e) {
        console.warn('[Feedback] Error during document clone sanitization:', e);
      }
    };

    // Ignore predicate for elements during cloning
    const isIgnored = (element: Element) => {
      try {
        if (!element || !element.tagName) return false;
        const tag = element.tagName.toUpperCase();
        if (tag === 'IFRAME' || tag === 'VIDEO' || tag === 'AUDIO') return true;
        if (element.id === 'credential_picker_container' || element.id === 'credential_picker_iframe')
          return true;
        if (
          element.hasAttribute &&
          (element.hasAttribute('data-feedback-ignore') ||
            element.hasAttribute('data-html2canvas-ignore'))
        )
          return true;
        if (
          element.closest &&
          (element.closest('[data-feedback-ignore="true"]') ||
            element.closest('[data-html2canvas-ignore="true"]'))
        )
          return true;
      } catch {
        return false;
      }
      return false;
    };

    try {
      const html2canvas = (await import('html2canvas')).default;
      const target = document.body;
      const canvas = await html2canvas(target, {
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 1.5),
        onclone: sanitizeClone,
        ignoreElements: isIgnored,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
      });
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (err) {
      console.warn('[Feedback] Primary screenshot capture failed, trying fallback without crop offsets:', err);
      try {
        const html2canvas = (await import('html2canvas')).default;
        const target = document.getElementById('root') || document.body;
        const canvas = await html2canvas(target, {
          useCORS: true,
          allowTaint: false,
          logging: false,
          scale: 1,
          onclone: sanitizeClone,
          ignoreElements: isIgnored,
        });
        return canvas.toDataURL('image/jpeg', 0.8);
      } catch (fallbackErr) {
        console.error('[Feedback] Screenshot fallback capture also failed:', fallbackErr);
        return null;
      }
    }
  };

  const handleOpenWidget = async () => {
    setIsCapturing(true);

    // Wait a brief tick so any pending DOM updates settle
    await new Promise((r) => setTimeout(r, 60));

    const captured = await captureCurrentScreen();
    setScreenshotData(captured);
    setIsCapturing(false);
    setIsOpen(true);
  };

  const handleRetakeScreenshot = async (): Promise<string | null> => {
    setIsCapturing(true);
    // Temporarily hide all feedback ignored elements (dialog backdrop, triggers) during capture
    const ignoredElems = document.querySelectorAll<HTMLElement>(
      '[data-feedback-ignore="true"], [data-html2canvas-ignore="true"]'
    );
    ignoredElems.forEach((el) => {
      el.style.visibility = 'hidden';
    });

    await new Promise((r) => setTimeout(r, 80));
    const captured = await captureCurrentScreen();

    ignoredElems.forEach((el) => {
      el.style.visibility = 'visible';
    });

    setScreenshotData(captured);
    setIsCapturing(false);
    return captured;
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div
        data-feedback-ignore="true"
        data-html2canvas-ignore="true"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 8999,
          display: isOpen ? 'none' : 'flex',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={handleOpenWidget}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          disabled={isCapturing}
          title="Kirim Masukan atau Laporkan Kendala"
          aria-label="Kirim Masukan atau Laporkan Kendala"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: 'var(--color-primary-500, #0171E3)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '9999px',
            cursor: isCapturing ? 'wait' : 'pointer',
            boxShadow: isHovered
              ? '0 10px 25px -5px rgba(1, 113, 227, 0.45), 0 8px 10px -6px rgba(1, 113, 227, 0.2)'
              : '0 4px 14px 0 rgba(0, 0, 0, 0.15)',
            transform: isHovered ? 'translateY(-2px)' : 'none',
            transition: 'all 0.2s ease-in-out',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          {isCapturing ? (
            <>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span>Menangkap Layar...</span>
            </>
          ) : (
            <>
              <ChatBubbleLeftRightIcon style={{ width: '18px', height: '18px' }} />
              <span>Feedback & Bug</span>
            </>
          )}
        </button>
      </div>

      {/* Main Feedback Dialog */}
      <FeedbackDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialScreenshot={screenshotData}
        onRetakeScreenshot={handleRetakeScreenshot}
        isRetaking={isCapturing}
      />
    </>
  );
};

export default FeedbackWidget;
