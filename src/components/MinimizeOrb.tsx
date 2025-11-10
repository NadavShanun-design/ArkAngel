import { useState, useEffect, useRef } from 'react';
import { getCurrentWindow, LogicalPosition, currentMonitor } from '@tauri-apps/api/window';

interface MinimizeOrbProps {
  isMinimized: boolean;
  onRestore: () => void;
}

export const MinimizeOrb = ({ isMinimized, onRestore }: MinimizeOrbProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const mouseDownTimeRef = useRef<number>(0);
  const mouseDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartedRef = useRef(false);

  useEffect(() => {
    if (!isMinimized) return;

    console.log('[ORB] Mounted - minimized mode active');

    // Snap to edge after a short delay when orb becomes visible
    const timer = setTimeout(() => {
      console.log('[ORB] Auto-snapping to edge...');
      snapToEdge();
    }, 100);

    return () => clearTimeout(timer);
  }, [isMinimized]);

  if (!isMinimized) return null;

  const handleMouseDown = async (e: React.MouseEvent) => {
    console.log('[ORB] === MOUSE DOWN ===');
    mouseDownTimeRef.current = Date.now();
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    dragStartedRef.current = false;
    setIsDragging(false);

    // Start dragging after a small delay to differentiate from click
    const dragTimeout = setTimeout(async () => {
      console.log('[ORB] Starting drag after delay...');
      try {
        const window = getCurrentWindow();
        await window.startDragging();
        console.log('[ORB] Drag initiated successfully');
        dragStartedRef.current = true;
        setIsDragging(true);
      } catch (error) {
        console.error('[ORB] Failed to start dragging:', error);
      }
    }, 150);

    // Store timeout to clear if mouse released quickly
    (e.target as any).__dragTimeout = dragTimeout;
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    console.log('[ORB] === MOUSE UP ===');
    const mouseUpTime = Date.now();
    const timeDiff = mouseUpTime - mouseDownTimeRef.current;
    const positionDiff = Math.abs(e.clientX - mouseDownPosRef.current.x) + Math.abs(e.clientY - mouseDownPosRef.current.y);

    console.log('[ORB] Time diff:', timeDiff, 'ms, Position diff:', positionDiff, 'px');
    console.log('[ORB] Drag was started:', dragStartedRef.current);

    // Clear drag timeout if exists
    const dragTimeout = (e.target as any).__dragTimeout;
    if (dragTimeout) {
      clearTimeout(dragTimeout);
    }

    // If click was quick (< 200ms) and mouse didn't move much (< 5px), it's a click
    if (timeDiff < 200 && positionDiff < 5 && !dragStartedRef.current) {
      console.log('[ORB] CLICK detected - restoring window');
      onRestore();
    } else if (dragStartedRef.current) {
      // Was dragging - snap to nearest edge
      console.log('[ORB] DRAG detected - snapping to edge');
      await snapToEdge();
      setIsDragging(false);
    }
  };

  const snapToEdge = async () => {
    try {
      const window = getCurrentWindow();
      const pos = await window.outerPosition();
      const monitor = await currentMonitor();

      if (!monitor) return;

      const screenWidth = monitor.size.width;
      const screenHeight = monitor.size.height;
      const orbSize = 60;
      const padding = 20;

      let newX = pos.x;
      let newY = pos.y;

      // Calculate distances to all four edges
      const distToLeft = pos.x;
      const distToRight = screenWidth - (pos.x + orbSize);
      const distToTop = pos.y;
      const distToBottom = screenHeight - (pos.y + orbSize);

      // Find the closest edge
      const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

      // Snap to the closest edge
      if (minDist === distToLeft) {
        // Snap to left edge
        newX = padding;
        newY = Math.max(padding, Math.min(screenHeight - orbSize - padding, pos.y));
      } else if (minDist === distToRight) {
        // Snap to right edge
        newX = screenWidth - orbSize - padding;
        newY = Math.max(padding, Math.min(screenHeight - orbSize - padding, pos.y));
      } else if (minDist === distToTop) {
        // Snap to top edge
        newY = padding;
        newX = Math.max(padding, Math.min(screenWidth - orbSize - padding, pos.x));
      } else {
        // Snap to bottom edge
        newY = screenHeight - orbSize - padding;
        newX = Math.max(padding, Math.min(screenWidth - orbSize - padding, pos.x));
      }

      // Ensure position is within screen bounds
      newX = Math.max(0, Math.min(screenWidth - orbSize, newX));
      newY = Math.max(0, Math.min(screenHeight - orbSize, newY));

      await window.setPosition(new LogicalPosition(newX, newY));

      // Save position to localStorage
      localStorage.setItem('arkangel-orb-position', JSON.stringify({ x: newX, y: newY }));
    } catch (error) {
      console.error('[ORB] Failed to snap to edge:', error);
    }
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="fixed inset-0 flex items-center justify-center cursor-move select-none"
    >
      <div
        className={`w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-2xl flex items-center justify-center transition-all ${
          isHovering ? 'scale-110' : isDragging ? 'scale-105 opacity-80' : 'scale-100'
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      </div>
    </div>
  );
};
