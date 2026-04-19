import { useState, useEffect, useCallback } from "react";

export function useMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(true);
  const [touchSupported, setTouchSupported] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent);
      const isSmallScreen = window.innerWidth <= 768;
      const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      
      setIsMobile(isMobileDevice || isSmallScreen);
      setIsPortrait(window.innerHeight > window.innerWidth);
      setTouchSupported(isTouch);
    };

    checkMobile();
    
    window.addEventListener("resize", checkMobile);
    window.addEventListener("orientationchange", checkMobile);
    
    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("orientationchange", checkMobile);
    };
  }, []);

  const vibrate = useCallback((pattern = 50) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, []);

  return { isMobile, isPortrait, touchSupported, vibrate };
}
