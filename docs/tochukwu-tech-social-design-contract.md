# Tochukwu Tech and AI Academy Social Design Contract

Version: 1.0  
Status: Locked source of truth  
Applies to: Prompt to Profit™ square social campaign artwork  
Reference date: 2 August 2026

## 1. Purpose

This contract defines the visual and production standard for Tochukwu Tech and AI Academy social designs. It exists to make every new artwork feel like part of one premium campaign while still allowing each idea to have a distinct visual concept.

The goal is not to repeat one layout. The goal is to preserve the same level of restraint, clarity, hierarchy, polish and mobile legibility found in the approved reference designs.

## 2. Authoritative references

The following three approved designs are the visual source of truth:

1. `design-01-first-website-v2.png`
   - Approved pattern: centred headline with a conceptual visual beneath it.
   - Source: `deliverables/social-campaign-30/source/design-01-first-website-v2.html`
2. `design-02-build-with-ai-v2.png`
   - Approved pattern: left-aligned copy with one dominant conceptual visual on the right.
   - Source: `deliverables/social-campaign-30/source/design-02-build-with-ai-v2.html`
3. `Accessible learning design.png`
   - Approved pattern: dominant conceptual visual on the left with copy and small supporting feature cards on the right.
   - Source: `deliverables/social-campaign-30/source/design-05-accessible-learning.html`

When a new idea conflicts with this contract, these three designs and their source files decide the correct direction.

## 3. The defining visual character

Every approved design should feel:

- clean;
- spacious;
- premium but approachable;
- modern and technology-led;
- beginner-friendly;
- visually confident without being loud;
- bright, not dark or heavy;
- easy to understand in one glance; and
- highly legible on a mobile phone.

The designs use strong editorial composition, not poster clutter. One idea leads. One conceptual visual supports it. The campaign information appears in a stable footer system.

## 4. Mandatory production method

This is a non-negotiable part of the design contract.

### 4.1 AI generates the visual, not the finished poster

AI image generation may create only the central illustration, scene or conceptual object. It must not generate the final text-bearing social design.

Never ask an image model to render:

- the academy logo;
- headlines or supporting copy;
- Prompt to Profit™;
- cohort dates;
- the naira symbol or course price;
- the website address;
- the footer; or
- feature-card text.

Those elements must be added deterministically in HTML and CSS using the official assets and exact copy.

### 4.2 Required production sequence

1. Approve the headline, supporting copy and any optional labels.
2. Select one permitted layout family from Section 8.
3. Generate or source one text-free conceptual visual.
4. Place the visual as a full-canvas background layer.
5. Add a directional white wash where needed to protect text contrast.
6. Add the official academy logo as an image asset.
7. Add all text, labels, cards and campaign information in HTML and CSS.
8. Render the 1080 × 1080 HTML composition to PNG.
9. Inspect the full-size image and a phone-size preview.
10. Correct any spacing, spelling, contrast or visual-logic problems before approval.

### 4.3 Required deliverables

Each completed design should have:

- one text-free visual asset;
- one editable HTML/CSS source file; and
- one final 1080 × 1080 PNG.

The final PNG must never be the only editable source.

## 5. Canvas and safe areas

### Canvas

- Final size: exactly `1080 × 1080 px`.
- Aspect ratio: `1:1` only.
- Background: white or a very light warm neutral.
- Overflow: hidden.

### Outer margins

- Main horizontal content margin: approximately `55 px`.
- Official logo position: `55 px` from the left and `45 px` from the top.
- Top-right programme or topic label: approximately `52 px` from the right and `57–61 px` from the top.
- Promotional footer: `30 px` from the left and right, and `24 px` from the bottom.

### Vertical zones

- Brand zone: approximately `45–150 px`.
- Main message and visual zone: approximately `180–825 px`.
- Fixed promotional footer zone: approximately `844–1056 px`.

No important visual or copy may compete with the promotional footer.

## 6. Brand assets

### Official logo

- Use `public/brand/tochukwu-tech-logo.png`.
- Standard displayed width: approximately `390 px`.
- Keep its original proportions.
- Never redraw, regenerate, recolour, crop or distort it.
- Do not place the headline close to the logo.
- Preserve generous empty space below and around the logo.

### Programme identifier

- `Prompt to Profit™` is mandatory on every Prompt to Profit campaign design.
- Preferred position: top right.
- Preferred treatment: white pill with a thin pale-blue border.
- Standard typography: `14 px`, bold, uppercase, royal blue, approximately `.09em` letter spacing.
- Standard padding: approximately `11 px 17 px`.
- Standard pill radius: `999 px`.

A topic label such as `INCLUSIVE LEARNING` may replace the top-right pill only if `Prompt to Profit™` remains clearly visible elsewhere in the upper brand or message area. It must never disappear from the design.

## 7. Colour system

Use the following colours as the default palette:

| Role | Value |
|---|---:|
| Primary navy text | `#07172F` |
| Deep navy footer | `#06162E` |
| Academy royal blue | `#0A54DC` |
| Pale-blue panel | `#F8FAFF` |
| Light-blue icon background | `#E8F0FF` |
| Main light border | `#D8E1EF` |
| Footer border | `#DCE2EB` |
| Date-card border | `#CFD7E3` |
| White | `#FFFFFF` |
| Muted blue footer text | `#A7C2F5` |

### Colour rules

- Navy carries the main message.
- Royal blue highlights one important phrase, not whole paragraphs.
- White and warm off-white dominate the canvas and the 3D materials.
- Blue may appear as a cable, object, figure, interface element or controlled glow.
- Use soft pale-blue light only to add depth or protect contrast.
- Do not introduce gold, purple, red, green or multicolour gradients unless explicitly approved for a specific campaign.
- Do not use a large dark-blue background for this campaign system.

## 8. Permitted layout families

Each design must choose one primary layout family. Do not combine all three.

### Layout A: centred editorial message

Use when the headline is the central campaign idea.

- Logo remains top left.
- Prompt to Profit™ remains top right.
- Kicker, headline and support copy are centred.
- Conceptual visual sits mainly beneath the copy.
- A vertical white wash may protect the upper text area.
- Reference: `design-01-first-website-v2.png`.

Suggested message position:

- top: approximately `184 px`;
- left and right: approximately `55 px`;
- maximum headline width: approximately `950 px`; and
- support-copy width: approximately `770 px`.

### Layout B: copy left, visual right

Use when the visual represents action, effort, movement or transformation.

- Message block begins around `218 px` from the top and `55 px` from the left.
- Copy width: approximately `500 px`.
- Visual occupies the right half and may extend behind the copy wash.
- Use a left-to-right white wash to keep the copy readable.
- Optional outcome pills may sit below the support copy.
- Reference: `design-02-build-with-ai-v2.png`.

### Layout C: visual left, copy right

Use when one large symbolic object carries the story.

- Visual occupies roughly the left half.
- Message block begins around `205 px` from the top and `53 px` from the right.
- Message width: approximately `465 px`.
- Use a right-side white wash to protect copy contrast.
- Up to two small supporting feature cards may appear under the copy.
- Reference: `Accessible learning design.png`.

### Layout-selection rule

Choose the layout that makes the idea easiest to understand. Variation must come from the visual concept and composition, not from changing the brand shell or footer.

## 9. Typography

### Font family

Use:

```css
font-family: Arial, Helvetica, sans-serif;
```

Do not substitute a condensed, decorative, serif or handwritten display font.

### Headline

- Size range: `56–64 px`.
- Weight: `700`.
- Line height: `.99–1.04`.
- Letter spacing: approximately `-.042em` to `-.052em`.
- Colour: primary navy.
- Highlight: one short phrase in royal blue.
- Typical length: two to four short lines.
- It must remain readable at phone-feed size.

### Kicker

- Size: `16 px`.
- Weight: `700`.
- Uppercase.
- Royal blue.
- Letter spacing: approximately `.09em`.
- Use one short blue line before it for left-aligned layouts.
- Use matching lines before and after it for centred layouts.

### Supporting copy

- Size range: `21–24 px`.
- Weight: `500` when available.
- Line height: `1.38–1.43`.
- Colour: primary navy.
- Keep it short, direct and beginner-friendly.

### Optional pills

- Size: approximately `13 px`.
- Bold and uppercase.
- Royal-blue text.
- White background.
- Thin pale-blue border.
- Use no more than three.

### Optional feature cards

- Use no more than two.
- Strong label: approximately `18 px`.
- Micro-label: approximately `10 px`, uppercase and royal blue.
- Thin neutral border.
- White background at high opacity.
- Soft, restrained shadow.
- These cards support the idea and must never resemble a busy dashboard.

## 10. Copy and messaging rules

- Lead with a transformation, possibility or valuable outcome.
- Speak to beginners in plain, natural English.
- Use contractions where natural, for example `Don’t` rather than `Do not`.
- Keep the headline concise and memorable.
- Keep supporting copy to one short paragraph, normally no more than three lines.
- Use one action-oriented kicker when helpful.
- Avoid jargon, technical feature lists and long explanations.
- Avoid dashes in newly written marketing copy unless the supplied approved copy already contains one.
- Do not invent student testimonials, statistics or guaranteed outcomes.
- Do not make unverified claims.
- Proofread every word before export.

## 11. Conceptual imagery

The central visual should communicate the campaign idea before the viewer reads all the copy.

### Approved visual qualities

- One dominant concept.
- Editorial 3D illustration or refined conceptual still life.
- Warm-white, ceramic, plaster or softly matte materials.
- Academy-blue focal objects or accents.
- Soft studio lighting.
- Restrained blue edge light or ground glow.
- Clean object geometry.
- Realistic contact shadows.
- Generous negative space around the object.

### Examples from the references

- An idea bulb connected to a working website interface.
- A blue builder placing the final block in a useful digital system.
- An ear paired with captions and transcript cues.

The imagery is metaphorical but immediately understandable. It does not simply decorate the poster.

### Image-generation prompt pattern

Use this structure when creating the text-free visual:

```text
Create a premium editorial 3D conceptual visual for a square technology-education campaign.

Concept: [ONE CLEAR METAPHOR CONNECTED TO THE MESSAGE].
Materials: warm white ceramic or plaster with academy royal-blue accents.
Lighting: soft high-key studio lighting with a restrained pale-blue edge glow.
Composition: [LEFT / RIGHT / LOWER] weighted, with generous clean negative space for deterministic copy.
Background: white or very light warm neutral.

No text. No logo. No dates. No prices. No website address. No watermark.
No device-perspective errors. No unnecessary objects. No busy interface. No dark background.
```

## 12. Directional white wash

The background visual may extend behind the copy only when a white wash protects legibility.

Approved wash directions:

- Top-to-bottom for centred headline layouts.
- Left-to-right for copy-left layouts.
- Right-to-left for copy-right layouts.

The wash should feel natural and nearly invisible. It must not look like a decorative gradient.

## 13. Locked promotional footer

For designs published through the penultimate week of August, the promotional footer is mandatory and must remain visually consistent.

### Footer position

- Left: `30 px`.
- Right: `30 px`.
- Bottom: `24 px`.
- Total width: `1020 px`.

### Upper offer panel

- Height: `148 px`.
- Grid: flexible cohort section plus `292 px` price section.
- Background: white at approximately `99%` opacity.
- Border: `1 px solid #DCE2EB`.
- Top border radius: `26 px`.
- Shadow: soft navy shadow, approximately `0 18px 45px rgba(7,23,47,.14)`.

### Cohort section

- Padding: approximately `18 px 22 px`.
- Calendar icon container: `72 × 72 px`.
- Icon-container radius: `18 px`.
- Icon background: royal blue.
- Label: `AUGUST COHORTS`, `16 px`, bold, uppercase and royal blue.
- Dates: `03`, `10`, `17`, `24`.
- Month: `AUG` under each date.
- Date-card minimum width: `74 px`.
- Date number: approximately `31 px`.
- Date-card radius: `13 px`.
- Gap: approximately `10 px`.

### Price section

- Width: `292 px`.
- Background: `#F8FAFF`.
- Left border: `1 px solid #D7DEE8`.
- Circular naira icon: `67 × 67 px`, royal blue with a white `₦`.
- Label: `COURSE FEE`.
- Price: `₦10,000` at approximately `35 px`, bold.
- Supporting word: `ONLY`, uppercase and royal blue.
- The naira symbol must be the real `₦` character added in HTML, never AI-generated lettering.

### Lower website bar

- Height: `64 px`.
- Background: `#06162E`.
- Bottom border radius: `26 px`.
- Left text: `www.tochukwunkwocha.com` in white at approximately `18 px`.
- Right text: `LEARN • BUILD • TRANSFORM` in muted blue, bold uppercase with wide tracking.

### Campaign-data rule

Dates, price and campaign labels are data, not illustration. Update them in the HTML source when the campaign changes. Never ask an image model to rewrite them.

## 14. Mobile-legibility standard

Every design must be evaluated at approximately `360 × 360 px`, not only at full size.

At phone size:

- the headline must be readable immediately;
- the royal-blue emphasis must remain visible;
- the supporting copy must not become grey texture;
- cohort dates must remain distinguishable;
- `₦10,000` must remain readable;
- the website must remain readable; and
- the logo must remain recognisable.

If any essential element fails at phone size, simplify the design. Do not solve the problem by adding more visual elements.

## 15. Privacy and screenshot rules

- Screenshots are not part of the default visual language.
- Use a screenshot only when the campaign idea specifically requires product proof or interface education.
- Never use a screenshot merely to fill space.
- Remove or irreversibly obscure names, email addresses, phone numbers, references, payment identifiers and other personal information before composition.
- When a screenshot is optional, prefer a purpose-built conceptual visual.

## 16. Prohibited design drift

Reject a design if it contains any of the following:

- an AI-generated academy logo;
- AI-generated poster text;
- a missing Prompt to Profit™ identifier;
- a dark or saturated full-canvas background;
- gold as a dominant campaign colour;
- multiple large banners competing with the headline;
- oversized programme labels in the middle of the composition;
- dashboard-card clutter;
- cartoon profile-card grids;
- more than one dominant visual metaphor;
- tiny body copy;
- cramped text near the logo;
- a headline placed over a visually busy background;
- an altered promotional footer;
- an incorrect naira symbol;
- a misspelt website address;
- fake testimonials or invented results;
- physically impossible devices, screen directions, hands, reflections or perspectives;
- unnecessary decorative icons;
- content touching the canvas edge; or
- any export that is not exactly 1080 × 1080.

## 17. Quality-control checklist

### Brand

- [ ] Official logo asset used without alteration.
- [ ] Logo placed near `55 px, 45 px` at approximately `390 px` wide.
- [ ] Prompt to Profit™ is clearly visible.
- [ ] Navy, royal blue, white and pale blue dominate.

### Message

- [ ] Headline expresses one clear outcome.
- [ ] Only one short phrase is highlighted in blue.
- [ ] Supporting copy is short and beginner-friendly.
- [ ] Copy contains no spelling or punctuation errors.
- [ ] No unapproved claim or testimonial appears.

### Visual

- [ ] One conceptual visual supports the message.
- [ ] Visual contains no generated words, logos, dates or prices.
- [ ] Geometry, perspective, contact shadows and object relationships are credible.
- [ ] Composition has generous negative space.
- [ ] No irrelevant or repetitive object is present.

### Promotional footer

- [ ] Footer dimensions and position match the locked shell.
- [ ] All four cohort dates are correct.
- [ ] Course fee is correct.
- [ ] Real naira symbol is used.
- [ ] Website is spelt correctly.
- [ ] Brand line reads `LEARN • BUILD • TRANSFORM`.

### Export

- [ ] Final PNG is exactly 1080 × 1080.
- [ ] Full-size visual inspection completed.
- [ ] 360 × 360 mobile preview inspected.
- [ ] Essential copy and campaign data remain legible at phone size.
- [ ] Editable HTML/CSS source and text-free visual are retained.

## 18. Approval test

Before approving any new design, place it beside all three authoritative references and ask:

1. Does it have the same calm confidence and generous whitespace?
2. Is the logo treatment identical in quality and position?
3. Does the typography have the same strength and restraint?
4. Is there one strong visual metaphor rather than a collection of graphics?
5. Is the promotional footer effectively the same component?
6. Can the design be understood and read on a phone?
7. Was all important text added deterministically rather than generated inside the image?

If any answer is no, the design is not ready.

