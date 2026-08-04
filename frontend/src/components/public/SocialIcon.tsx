import type { ReactNode } from 'react';
import type { SocialLinkId } from '../../types/social-links';

const META: Record<
  SocialLinkId,
  { color: string; paths: ReactNode }
> = {
  instagram: {
    color: '#e1306c',
    paths: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </>
    ),
  },
  telegram: {
    color: '#229ed9',
    paths: <path d="M21 4L3 11l5 2 2 6 3-4 5 4z" />,
  },
  whatsapp: {
    color: '#25d366',
    paths: (
      <>
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4L3 21l1.1-3.3A8.4 8.4 0 1 1 21 11.5z" />
        <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5" />
      </>
    ),
  },
  linkedin: {
    color: '#0a66c2',
    paths: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4" />
      </>
    ),
  },
  x: {
    color: '#e7ecf3',
    paths: <path d="M4 4l16 16M20 4L4 20" />,
  },
};

export function SocialIcon({
  id,
  size = 18,
  className,
}: {
  id: SocialLinkId;
  size?: number;
  className?: string;
}) {
  const meta = META[id];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {meta.paths}
    </svg>
  );
}

export function socialBrandColor(id: SocialLinkId): string {
  return META[id].color;
}
