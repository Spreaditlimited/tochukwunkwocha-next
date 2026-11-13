# Tochukwu’s Inner Circle

The identity combines a personal lowercase **t**, an open outer circle, and an inner arc. It represents a welcoming membership community and a place to grow. The primary palette matches the vault: pale lime `#C1EC8E`, forest `#141B17`, and warm off-white `#F4F6F1`.

## Finished assets

Files are in `public/brand/`:

- `inner-circle-logo.svg` and `.png`: primary transparent logo for dark backgrounds.
- `inner-circle-logo-light.svg` and `.png`: dark-ink transparent logo for light backgrounds.
- `inner-circle-icon.svg` and `.png`: standalone transparent lime symbol.
- `inner-circle-app-icon.svg` and `.png`: symbol on a forest rounded square.
- `favicon.png`: 32px browser icon.
- `apple-touch-icon.png`: 180px home-screen icon.
- `brand-preview.png`: overview of the identity.

SVG lettering uses outlines and requires no installed font or external font request. Use the SVG assets for websites and print. PNG logo exports are 1920px wide, the standalone symbol is 1024px square, and the app icon is 512px square. Keep clearspace around the logo and preserve its proportions. Use the standalone symbol when the full wordmark would become too small. Don’t add shadows, gradients, textures, or additional rings.

The vault uses the primary SVG logo on the login screen and member sidebar, plus the app icon as its favicon. Only branding lives in the public asset directory; member documents remain in private R2.

## Production source

`scripts/build-brand.cjs` defines the precise geometry and outlined typography. It renders the checked-in SVG and PNG assets using the parent repository’s `fontkit` and `sharp` dependencies. Regenerate from the repository root with:

```sh
node inner-circle-vault/scripts/build-brand.cjs
```

Regeneration requires macOS Arial and Arial Bold under `/System/Library/Fonts/Supplemental/`. Exported assets don’t depend on those fonts at runtime. No additional runtime dependency is added to the Worker.

## Concept generation

The concept was explored with the built-in ImageGen tool, then rebuilt as precise vector artwork to remove the rough transparency and lettering edges in the generated concepts. No generated raster is used as production source.

Initial prompt: “A bespoke geometric lowercase t integrated with a circular enclosure and smaller inner arc for Tochukwu’s Inner Circle. Warm, approachable, modern membership identity; recognizable at favicon size; pale lime #C1EC8E; transparent background; no shadows, gradients, texture, padlock, keyhole, crown, or laurel.”

Refinement prompt: “Preserve the t, open C-like outer circle and smaller lower inner arc. Re-render as clean solid geometric artwork, with uniform pale lime fill and transparent gaps, eliminating all noise, fringe, shadows and gradients.”

Wordmark prompt: “Use the same symbol at left, with two-line lettering at right: TOCHUKWU’S above INNER CIRCLE, in warm off-white #F4F6F1, clean sans serif, carefully spaced and kerned. Horizontal composition, transparent background, no tagline, texture, shadow or mockup.”
