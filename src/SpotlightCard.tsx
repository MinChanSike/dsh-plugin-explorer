import React, { useRef, useCallback } from "react";

export interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
  className?: string;
  children: React.ReactNode;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  spotlightColor = "rgba(56, 139, 253, 0.15)",
  className = "",
  children,
  style,
  onPointerMove,
  onPointerLeave,
  ...rest
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Update CSS variables for zero-rerender spotlight tracking
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);

      if (onPointerMove) {
        onPointerMove(e);
      }
    },
    [onPointerMove],
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (onPointerLeave) {
        onPointerLeave(e);
      }
    },
    [onPointerLeave],
  );

  return (
    <div
      ref={cardRef}
      className={`spotlight-card ${className}`}
      style={style}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      {...rest}
    >
      {/* Zero-rerender Spotlight radial gradient overlay */}
      <div
        className="spotlight-overlay"
        style={{
          background: `radial-gradient(350px circle at var(--mouse-x, -999px) var(--mouse-y, -999px), ${spotlightColor}, transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
};

// Export alias for backward compatibility if needed
export const TiltSpotlightCard = SpotlightCard;
