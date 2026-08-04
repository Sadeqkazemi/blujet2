import type { CSSProperties } from 'react';

type Props = {
  /** When true (fa/ar), flip so the nose faces left — toward destination in RTL. */
  rtl?: boolean;
  style?: CSSProperties;
  size?: number | string;
};

/**
 * Airplane glyph for origin→destination timelines on results cards.
 * In RTL the emoji faces left (destination); in LTR it keeps the default rightward nose.
 */
export default function FlightPathPlane({ rtl = true, style, size = 14.5 }: Props) {
  return (
    <span
      aria-hidden
      data-testid="flight-path-plane"
      data-rtl={rtl ? 'true' : 'false'}
      style={{
        display: 'inline-block',
        fontSize: size,
        lineHeight: 1,
        color: '#c2cad4',
        transform: rtl ? 'scaleX(-1)' : undefined,
        ...style,
      }}
    >
      ✈
    </span>
  );
}
