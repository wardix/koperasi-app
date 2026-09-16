import React, { useState } from 'react';
import { ChatBubbleLeftRightIcon, CameraIcon } from '@heroicons/react/24/outline';
import { FeedbackDialog } from './FeedbackDialog';

export const FeedbackWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const captureCurrentScreen = async (): Promise<string | null> => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 1.5),
        ignoreElements: (element) => element.hasAttribute('data-feedback-ignore'),
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
      });
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (err) {
      console.warn('Screenshot capture failed gracefully:', err);
      return null;
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

  const handleRetakeScreenshot = async () => {
    setIsCapturing(true);
    // Temporarily hide the dialog backdrop during capture
    const dialogElem = document.querySelector('[data-feedback-ignore="true"]') as HTMLElement | null;
    if (dialogElem) {
      dialogElem.style.visibility = 'hidden';
    }

    await new Promise((r) => setTimeout(r, 60));
    const captured = await captureCurrentScreen();

    if (dialogElem) {
      dialogElem.style.visibility = 'visible';
    }

    setScreenshotData(captured);
    setIsCapturing(false);
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div
        data-feedback-ignore="true"
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
