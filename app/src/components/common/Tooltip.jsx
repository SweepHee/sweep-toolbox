import { useState, useRef, useLayoutEffect } from 'react';

/**
 * @param {string}          content   - 툴팁 텍스트
 * @param {'top'|'bottom'}  position  - 기본값 'bottom'
 */
export default function Tooltip({ children, content, position = 'bottom' }) {
  const [show, setShow]   = useState(false);
  const [shift, setShift] = useState(0);
  const tooltipRef = useRef(null);
  const wrapperRef = useRef(null);
  const isBottom   = position === 'bottom';

  useLayoutEffect(() => {
    if (!show || !tooltipRef.current) return;
    const { left, right } = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const M  = 8;
    if (right > vw - M)  setShift(vw - M - right);
    else if (left < M)   setShift(M - left);
    else                 setShift(0);
  }, [show]);

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => { setShift(0); setShow(true); }}
      onMouseLeave={() => setShow(false)}
    >
      {children}

      {show && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{ marginLeft: shift }}
          className={[
            'absolute z-50 left-1/2 -translate-x-1/2 w-max max-w-64',
            'px-3 py-2 rounded-xl',
            'bg-[#1e1e30] border border-white/10 shadow-2xl',
            'text-xs text-white/70 leading-snug pointer-events-none',
            isBottom ? 'top-full mt-2 tooltip-enter' : 'bottom-full mb-2 tooltip-enter-up',
          ].join(' ')}
        >
          {content}
        </div>
      )}
    </div>
  );
}
