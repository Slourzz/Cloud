import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

interface CustomScrollbarProps {
  children: ReactNode;
  className?: string;
  idleTimeout?: number;
  size?: "normal" | "small";
  barWidth?: string;
  scrollbarOffsetX?: number;
  variant?: "minimal" | "liquid";
}

export function CustomScrollbar({
  children,
  className = "",
  idleTimeout = 1000,
  size = "normal",
  barWidth,
  scrollbarOffsetX = 0,
  variant = "minimal",
}: CustomScrollbarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [thumbTop, setThumbTop] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [visible, setVisible] = useState(false);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const width = barWidth || (size === "small" ? "4px" : "6px");
  const thumbMin = size === "small" ? 18 : 24;

  const showThumb = useCallback(() => {
    setVisible(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setVisible(false), idleTimeout);
  }, [idleTimeout]);

  const updateThumb = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const thumbHeightRatio = clientHeight / scrollHeight;
    let newThumbHeight = clientHeight * thumbHeightRatio;
    newThumbHeight = Math.max(thumbMin, Math.min(clientHeight, newThumbHeight));
    setThumbHeight(newThumbHeight);
    const maxThumbTop = clientHeight - newThumbHeight;
    const scrollableHeight = scrollHeight - clientHeight;
    const newThumbTop =
      scrollableHeight > 0 ? (scrollTop / scrollableHeight) * maxThumbTop : 0;
    setThumbTop(isNaN(newThumbTop) ? 0 : newThumbTop);
  }, [thumbMin]);

  const handleScroll = useCallback(() => {
    updateThumb();
    showThumb();
  }, [updateThumb, showThumb]);

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    setIsDragging(true);
    showThumb();
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = containerRef.current.scrollTop;
    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!containerRef.current || !thumbRef.current) return;
    const deltaY = e.clientY - dragStartY.current;
    const { scrollHeight, clientHeight } = containerRef.current;
    const maxScrollTop = scrollHeight - clientHeight;
    const thumbMaxTop = clientHeight - thumbHeight;
    const scrollDelta = (deltaY / thumbMaxTop) * maxScrollTop;
    let newScrollTop = dragStartScrollTop.current + scrollDelta;
    newScrollTop = Math.min(maxScrollTop, Math.max(0, newScrollTop));
    containerRef.current.scrollTop = newScrollTop;
    updateThumb();
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    document.removeEventListener("mousemove", handleDragMove);
    document.removeEventListener("mouseup", handleDragEnd);
    showThumb();
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(() => updateThumb());
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [updateThumb]);

  useEffect(() => {
    updateThumb();
  }, [children, updateThumb]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleMouseEnter = () => showThumb();
    const handleMouseLeave = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setVisible(false), idleTimeout);
    };
    container.addEventListener("mouseenter", handleMouseEnter);
    container.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      container.removeEventListener("mouseenter", handleMouseEnter);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [showThumb, idleTimeout]);

  const showScrollbar = thumbHeight < (containerRef.current?.clientHeight ?? 0);

  return (
    <div className={`relative h-full ${className}`}>
      <div
        ref={containerRef}
        className="h-full overflow-y-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {children}
      </div>

      {showScrollbar && (
        <div
          className={`absolute bottom-0 top-0 rounded-full pointer-events-none ${
            variant === "liquid" ? "border border-white/10" : ""
          }`}
          style={{
            background:
              variant === "liquid"
                ? "linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.045))"
                : "transparent",
            backdropFilter:
              variant === "liquid" ? "blur(18px) saturate(145%)" : undefined,
            WebkitBackdropFilter:
              variant === "liquid" ? "blur(18px) saturate(145%)" : undefined,
            boxShadow:
              variant === "liquid"
                ? "inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 30px rgba(0,0,0,0.16)"
                : undefined,
            width,
            right: `${scrollbarOffsetX}px`,
          }}
        >
          <div
            ref={thumbRef}
            className="absolute rounded-full cursor-pointer pointer-events-auto transition-opacity duration-200"
            style={{
              width: "100%",
              height: `${thumbHeight}px`,
              transform: `translateY(${thumbTop}px)`,
              background:
                variant === "liquid"
                  ? isDragging
                    ? "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.68))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.36))"
                  : isDragging
                    ? "rgba(255, 255, 255, 0.6)"
                    : "rgba(255, 255, 255, 0.3)",
              border:
                variant === "liquid"
                  ? "1px solid rgba(255,255,255,0.38)"
                  : undefined,
              boxShadow:
                variant === "liquid"
                  ? "inset 0 1px 0 rgba(255,255,255,0.7), 0 5px 16px rgba(0,0,0,0.22)"
                  : undefined,
              opacity: visible ? 1 : 0,
            }}
            onMouseDown={handleDragStart}
          />
        </div>
      )}
    </div>
  );
}
