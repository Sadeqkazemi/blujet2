import type { CSSProperties } from 'react';

type Props = {
  /** When true (fa/ar), flip so the nose faces left — toward destination in RTL timelines. */
  rtl?: boolean;
  className?: string;
  style?: CSSProperties;
  size?: number | string;
};

/**
 * Airplane glyph for origin→destination timelines and route connectors.
 * In RTL the emoji faces left (destination); in LTR it keeps the default rightward nose.
 */
export default function FlightPathPlane({ rtl = true, className, style, size }: Props) {
  return (
    <span
      aria-hidden
      data-testid="flight-path-plane"
      data-rtl={rtl ? 'true' : 'false'}
      className={className}
      style={{
        display: 'inline-block',
        fontSize: size,
        lineHeight: 1,
        transform: rtl ? 'scaleX(-1)' : undefined,
        ...style,
      }}
    >
      ✈
    </span>
  );
}
