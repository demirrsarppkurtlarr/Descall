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
        gap: '10px',
        WebkitAppRegion: 'no-drag'
      }}>
        {/* Descall Logo */}
        <div style={{
          width: 32,
          height: 32,
          background: 'linear-gradient(135deg, #5865f2 0%, #4752c4 50%, #3b45a3 100%)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#fff',
          boxShadow: '0 2px 8px rgba(88, 101, 242, 0.4)',
          border: '2px solid rgba(255,255,255,0.1)',
        }}>
          D
        </div>
        <span style={{ 
          color: '#fff', 
          fontSize: '15px', 
          fontWeight: 700,
          letterSpacing: '0.5px'
        }}>
          Descall
        </span>
        
        {/* Menu items */}
        <div style={{ 
          display: 'flex', 
          gap: '4px', 
          marginLeft: '20px',
          color: '#b9bbbe',
          fontSize: '13px'
        }}>
          <span className="menu-item" style={menuItemStyle}>Dosya</span>
          <span className="menu-item" style={menuItemStyle}>Düzen</span>
          <span className="menu-item" style={menuItemStyle}>Görünüm</span>
          <span className="menu-item" style={menuItemStyle}>Yardım</span>
        </div>
      </div>

      {/* Right - Window Controls (Windows Style) */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center',
        WebkitAppRegion: 'no-drag'
      }}>
        {/* Fullscreen button */}
        <button 
          onClick={handleFullscreen}
          className="win-btn"
          style={{
            ...winBtnStyle,
            color: isFullscreen ? '#5865f2' : '#b9bbbe',
          }}
          title="Tam Ekran (F11)"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        {/* Minimize - Windows Style */}
        <button 
          onClick={handleMinimize}
          className="win-btn minimize"
          style={winBtnStyle}
          title="Küçült"
        >
          <Minus size={16} strokeWidth={2} />
        </button>
        
        {/* Maximize/Restore - Windows Style */}
        <button 
          onClick={handleMaximize}
          className="win-btn maximize"
          style={winBtnStyle}
          title={isMaximized ? "Geri Yükle" : "Büyüt"}
        >
          {isMaximized ? <Minimize2 size={14} strokeWidth={2} /> : <Square size={14} strokeWidth={2} />}
        </button>
        
        {/* Close - Windows Style (Red on hover) */}
        <button 
          onClick={handleClose}
          className="win-btn close"
          style={{
            ...winBtnStyle,
            width: '46px',
          }}
          title="Kapat"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// Windows-style button styles
const winBtnStyle = {
  width: '46px',
  height: '40px',
  background: 'transparent',
  border: 'none',
  color: '#b9bbbe',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
};

const menuItemStyle = {
  cursor: 'pointer',
  padding: '6px 10px',
  borderRadius: '4px',
  transition: 'all 0.15s',
};

// Windows-style hover effects CSS
const style = document.createElement('style');
style.textContent = `
  .titlebar {
    -webkit-app-region: drag;
  }
  .titlebar .win-btn {
    -webkit-app-region: no-drag;
  }
  .titlebar .win-btn:hover {
    background: #ffffff15 !important;
    color: #fff !important;
  }
  .titlebar .win-btn:active {
    background: #ffffff25 !important;
  }
  .titlebar .win-btn.close:hover {
    background: #e81123 !important;
    color: #fff !important;
  }
  .titlebar .win-btn.close:active {
    background: #f1707a !important;
  }
  .menu-item:hover {
    background: #ffffff10;
    color: #fff;
  }
`;
document.head.appendChild(style);
