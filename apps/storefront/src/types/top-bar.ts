export interface TopBarLink {
  label: string;
  href: string;
}

/** Admin-managed (Content > Top Bar). */
export interface TopBar {
  isEnabled: boolean;
  showStoreSwitcher: boolean;
  phone: string | null;
  message: string | null;
  links: TopBarLink[];
  /** false = nothing saved for this website yet (the built-in defaults are showing). */
  isCustomized: boolean;
}
