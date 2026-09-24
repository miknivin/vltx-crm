// Same VLTX brand mark the website uses (public/images/nav-logo.png there),
// so there's no branding drift between the two apps.
//
// The wordmark is near-white text on a transparent background — it was
// designed for the website's dark theme, and is invisible on this CRM's
// light-mode white background. LOGO_SRC keeps that original for dark
// surfaces (dark mode, or a permanently-dark panel); LOGO_LIGHT_SRC is the
// same wordmark recolored to a dark charcoal for light surfaces. Swap them
// with `dark:` Tailwind classes rather than picking one — see AppSidebar.tsx
// for the pattern.
//
// LOGO_ICON_SRC is a square crop of just the circular mark (no wordmark), for
// the sidebar's collapsed icon-rail state where the full wordmark would be
// squeezed illegibly into a 32x32 box. Its gold tone already reads fine on
// both light and dark, so it has no separate variant.
export const LOGO_SRC = "/images/logo/logo-dark.png";
export const LOGO_LIGHT_SRC = "/images/logo/logo-light.png";
export const LOGO_ICON_SRC = "/images/logo/logo-icon.png";
