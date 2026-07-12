# Tochukwu Tech Design Direction

## Brand Signal

Tochukwu Tech and AI Academy should feel practical, technical, and credible. The logo is sharp, geometric, and high-contrast, so the interface should avoid soft decorative styling and instead use clean structure, confident spacing, crisp borders, and clear hierarchy.

## Core Assets

- Wide logo: `public/brand/tochukwu-tech-logo.png`
- Icon: `public/brand/tochukwu-tech-logo-icon.png`
- Optimized icon: `public/brand/tochukwu-tech-logo-icon.webp`
- Reverse icon: `public/brand/tn-icon-reverse.png`
- Favicon source: `public/brand/favicon-source.png`

## Color System

- Deep navy: primary brand authority and dark surfaces.
- Academy blue: primary action color, links, active states, and SEO/admin emphasis.
- Sky blue: secondary accent, highlights, focus states, and dark-mode primary.
- Cool paper: public-page backgrounds and reading surfaces.
- White/ink: strong contrast for educational content and operational UI.

Use semantic Tailwind classes first: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `bg-primary`, `text-primary`. Use `brand-*` colors only when the brand itself needs to be explicit.

## UI Direction

- Public pages: calm, bright, content-led, with direct calls to learn, build, or contact.
- Student dashboard: operational and efficient, with clear navigation and restrained card surfaces.
- Internal dashboard: denser admin workspace with strong dark/navy structure and clear queue states.
- Cards should stay at `8px` radius or below.
- Avoid ornamental gradients, blobs, and oversized marketing layouts for dashboard areas.
- Icons should come from `lucide-react` where available.

## Theme Behavior

The site supports class-based light/dark mode through `.dark` tokens in `app/globals.css`.

- Theme boot script: `components/ThemeScript.tsx`
- Theme switcher: `components/ThemeToggle.tsx`
- Theme storage key: `tochukwu-theme`

## Files To Treat As Design Source

- `app/globals.css`: CSS variables, reusable classes, base typography.
- `tailwind.config.ts`: token exposure to Tailwind.
- `lib/brand.ts`: brand names, promise, asset paths, canonical hex references.
- `components/BrandMark.tsx`: shared logo lockup.
- `components/ThemeToggle.tsx`: light/dark control.
