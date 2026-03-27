import React, { useState, useEffect } from 'react';
import { MobileLayout } from './MobileLayout';

interface ResponsiveShellProps {
  desktopLayout: React.ReactNode;
  children: React.ReactNode;
}

const BREAKPOINT = 768;

export const ResponsiveShell: React.FC<ResponsiveShellProps> = ({ desktopLayout, children }) => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < BREAKPOINT);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < BREAKPOINT);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (isMobile) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  return <>{desktopLayout}</>;
};
