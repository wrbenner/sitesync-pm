import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
  type ReactNode,
  type CSSProperties,
} from 'react';
import ReactDOM from 'react-dom';
import { shadows, zIndex, typography, spacing } from '../../styles/theme';

type Placement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: string | ReactNode;
  children: ReactNode;
  placement?: Placement;
  delay?: number;
}

const ARROW_SIZE = 6;
const OFFSET = 8;

function getPosition(
  rect: DOMRect,
  tipRect: DOMRect,
  placement: Placement
): { top: number; left: number } {
  switch (placement) {
    case 'top':
      return {
        top: rect.top + window.scrollY - tipRect.height - OFFSET,
        left: rect.left + window.scrollX + rect.width / 2 - tipRect.width / 2,
      };
    case 'bottom':
      return {
        top: rect.bottom + window.scrollY + OFFSET,
        left: rect.left + window.scrollX + rect.width / 2 - tipRect.width / 2,
      };
    case 'left':
      return {
        top: rect.top + window.scrollY + rect.height / 2 - tipRect.height / 2,
        left: rect.left + window.scrollX - tipRect.width - OFFSET,
      };
    case 'right':
      return {
        top: rect.top + window.scrollY + rect.height / 2 - tipRect.height / 2,
        left: rect.right + window.scrollX + OFFSET,
      };
  }
}

function getArrowStyle(placement: Placement): CSSProperties {
  const base: CSSProperties = {
    position: 'absolute',
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderColor: 'transparent',
  };
  const color = '#1a1a2e';
  switch (placement) {
    case 'top':
      return {
        ...base,
        bottom: -ARROW_SIZE,
        left: '50%',
        transform: 'translateX(-50%)',
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px 0`,
        borderTopColor: color,
      };
    case 'bottom':
      return {
        ...base,
        top: -ARROW_SIZE,
        left: '50%',
        transform: 'translateX(-50%)',
        borderWidth: `0 ${ARROW_SIZE}px ${ARROW_SIZE}px`,
        borderBottomColor: color,
      };
    case 'left':
      return {
        ...base,
        right: -ARROW_SIZE,
        top: '50%',
        transform: 'translateY(-50%)',
        borderWidth: `${ARROW_SIZE}px 0 ${ARROW_SIZE}px ${ARROW_SIZE}px`,
        borderLeftColor: color,
      };
    case 'right':
      return {
        ...base,
        left: -ARROW_SIZE,
        top: '50%',
        transform: 'translateY(-50%)',
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px 0`,
        borderRightColor: color,
      };
  }
}

const translateMap: Record<Placement, string> = {
  top: 'translateY(4px)',
  bottom: 'translateY(-4px)',
  left: 'translateX(4px)',
  right: 'translateX(-4px)',
};

export function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 300,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tooltipId = useId();

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
    setPosition(null);
  }, []);

  useEffect(() => {
    if (visible && triggerRef.current && tooltipRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tipRect = tooltipRef.current.getBoundingClientRect();
      setPosition(getPosition(rect, tipRect, placement));
    }
  }, [visible, placement]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const tooltipStyle: CSSProperties = {
    position: 'absolute',
    zIndex: zIndex.tooltip,
    background: '#1a1a2e',
    color: '#ffffff',
    fontFamily: typography.fontFamily,
    fontSize: typography.fontSize.label,
    lineHeight: '1.4',
    padding: `${spacing['1.5']} ${spacing['2.5']}`,
    borderRadius: '6px',
    maxWidth: 250,
    boxShadow: shadows.dropdown,
    pointerEvents: 'none',
    opacity: position ? 1 : 0,
    transform: position ? 'translate(0)' : translateMap[placement],
    transition: 'opacity 150ms ease, transform 150ms ease',
    top: position?.top ?? -9999,
    left: position?.left ?? -9999,
  };

  return (
    <>
      <span
        ref={triggerRef}
        aria-describedby={visible ? tooltipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        tabIndex={0}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </span>
      {visible &&
        ReactDOM.createPortal(
          <div ref={tooltipRef} id={tooltipId} role="tooltip" style={tooltipStyle}>
            {content}
            <span style={getArrowStyle(placement)} />
          </div>,
          document.body
        )}
    </>
  );
}
