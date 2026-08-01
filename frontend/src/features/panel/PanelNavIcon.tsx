import { PANEL_NAV_ICON_PATHS } from './panel-nav-icons';

interface Props {
  navKey: string;
  size?: number;
}

export default function PanelNavIcon({ navKey, size = 20 }: Props) {
  const paths = PANEL_NAV_ICON_PATHS[navKey] ?? '<circle cx="12" cy="12" r="4"/>';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: paths }}
    />
  );
}
