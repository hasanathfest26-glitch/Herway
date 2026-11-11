'use client';

import React, { useEffect, useRef, useState } from 'react';

interface MotionRevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  mask?: boolean;
}

export function MotionReveal({
  children,
  className = '',
  delayMs = 0,
  mask = true,
}: MotionRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -16px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${mask ? 'herway-mask ' : ''}${className}`.trim()}>
      <div
        className="herway-reveal"
        data-visible={visible ? 'true' : 'false'}
        style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
