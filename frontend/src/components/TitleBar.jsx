import { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2, Minimize2 } from 'lucide-react';

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isElectron = window.electronWindow !== undefined;

  useEffect(() => {
    if (!isElectron) return;

    // Check initial state
    const checkState = async () => {
      const maximized = await window.electronWindow.isMaximized();
      const fullscreen = await window.electronWindow.isFullscreen();
      setIsMaximized(maximized);
      setIsFullscreen(fullscreen);
    };
    checkState();

    // Listen for resize events (optional - would need IPC from main)
    const handleResize = () => {
      checkState();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isElectron]);

  if (!isElectron) return null; // Only show in Electron

  const handleMinimize = () => window.electronWindow.minimize();
  
  const handleMaximize = async () => {
    await window.electronWindow.maximize();
    const maximized = await window.electronWindow.isMaximized();
    setIsMaximized(maximized);
  };
  
  const handleClose = () => window.electronWindow.close();
  
  const handleFullscreen = async () => {
    await window.electronWindow.fullscreen();
    const fullscreen = await window.electronWindow.isFullscreen();
    setIsFullscreen(fullscreen);
  };

  return (
    <div 
      className="titlebar"
      style={{
        height: '40px',
        background: '#1a1b1e',
        borderBottom: '1px solid #2f3136',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        WebkitAppRegion: 'drag', // Draggable area
        userSelect: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
      }}
    >
      {/* Left - Logo and Title */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        WebkitAppRegion: 'no-drag'
      }}>
        <div style={{
          width: 24,
          height: 24,
          background: 'linear-gradient(135deg, #5865f2, #4752c4)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#fff',
        }}>
          D
        </div>
        <span style={{ 
          color: '#fff', 
          fontSize: '14px', 
          fontWeight: 600,
          letterSpacing: '0.5px'
        }}>
          Descall
        </span>
        
        {/* Menu items */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          marginLeft: '24px',
          color: '#b9bbbe',
          fontSize: '13px'
        }}>
          <span style={menuItemStyle}>Dosya</span>
          <span style={menuItemStyle}>Düzen</span>
          <span style={menuItemStyle}>Görünüm</span>
          <span style={menuItemStyle}>Yardım</span>
        </div>
      </div>

      {/* Right - Window Controls */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px',
        WebkitAppRegion: 'no-drag'
      }}>
        {/* Fullscreen button */}
        <button 
          onClick={handleFullscreen}
          style={{
            ...btnStyle,
            color: isFullscreen ? '#5865f2' : '#b9bbbe',
          }}
          title="Tam Ekran (F11)"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        <div style={{ width: '1px', height: '16px', background: '#2f3136', margin: '0 4px' }} />

        {/* Minimize */}
        <button 
          onClick={handleMinimize}
          style={btnStyle}
          title="Küçült"
        >
          <Minus size={16} />
        </button>
        
        {/* Maximize/Restore */}
        <button 
          onClick={handleMaximize}
          style={btnStyle}
          title={isMaximized ? "Geri Yükle" : "Büyüt"}
        >
          {isMaximized ? <Minimize2 size={14} /> : <Square size={14} />}
        </button>
        
        {/* Close */}
        <button 
          onClick={handleClose}
          style={{
            ...btnStyle,
            color: '#ff5f57',
            hover: { background: '#ff5f5720' }
          }}
          onMouseEnter={(e) => e.target.style.background = '#ff5f5720'}
          onMouseLeave={(e) => e.target.style.background = 'transparent'}
          title="Kapat (Sistem Tepsisine Küçült)"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

const btnStyle = {
  width: '32px',
  height: '32px',
  background: 'transparent',
  border: 'none',
  color: '#b9bbbe',
  cursor: 'pointer',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
};

const menuItemStyle = {
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: '4px',
  transition: 'all 0.2s',
};

// Hover effect için CSS
const style = document.createElement('style');
style.textContent = `
  .titlebar button:hover {
    background: #ffffff10 !important;
    color: #fff !important;
  }
  .titlebar button:active {
    background: #ffffff20 !important;
  }
`;
document.head.appendChild(style);
