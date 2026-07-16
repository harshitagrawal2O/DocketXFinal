---
name: Docket
colors:
  surface: '#fff8ef'
  surface-dim: '#dfd9d0'
  surface-bright: '#fff8ef'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f9f3ea'
  surface-container: '#f3ede4'
  surface-container-high: '#ede7de'
  surface-container-highest: '#e8e2d9'
  on-surface: '#1d1b16'
  on-surface-variant: '#44474b'
  inverse-surface: '#33302a'
  inverse-on-surface: '#f6f0e7'
  outline: '#75777c'
  outline-variant: '#c5c6cc'
  surface-tint: '#565f6c'
  primary: '#07101a'
  on-primary: '#ffffff'
  primary-container: '#1c2530'
  on-primary-container: '#838c9a'
  inverse-primary: '#bec7d6'
  secondary: '#755a31'
  on-secondary: '#ffffff'
  secondary-container: '#fdd7a4'
  on-secondary-container: '#785c33'
  tertiary: '#0e0f0e'
  on-tertiary: '#ffffff'
  tertiary-container: '#242423'
  on-tertiary-container: '#8c8b89'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae3f2'
  primary-fixed-dim: '#bec7d6'
  on-primary-fixed: '#131c27'
  on-primary-fixed-variant: '#3e4754'
  secondary-fixed: '#ffddb1'
  secondary-fixed-dim: '#e5c18f'
  on-secondary-fixed: '#291800'
  on-secondary-fixed-variant: '#5b421c'
  tertiary-fixed: '#e4e2df'
  tertiary-fixed-dim: '#c8c6c4'
  on-tertiary-fixed: '#1b1c1a'
  on-tertiary-fixed-variant: '#474745'
  background: '#fff8ef'
  on-background: '#1d1b16'
  surface-variant: '#e8e2d9'
typography:
  headline-display:
    fontFamily: Newsreader
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Newsreader
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Newsreader
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-max-width: 1440px
  gutter: 24px
  margin-page: 48px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
This design system is built for high-stakes collaborative environments within Indian legal and financial practices. The aesthetic is rooted in the concept of "Digital Stationery"—evoking the tactile quality of high-grade bond paper, archival ink, and brass finishes found in prestigious chambers.

The style is **Editorial Minimalism**. It prioritizes extreme legibility, intentional use of negative space to reduce cognitive load during complex document review, and a sense of permanence. It avoids trendy visual flourishes in favor of precision, using hairline strokes and a sophisticated serif-to-sans hierarchy to signal authority and meticulousness.

## Colors
The palette is inspired by traditional legal materials.
- **Ink & Paper:** The "Paper" background (#FAF8F5) is a warm off-white that reduces eye strain compared to pure white, paired with "Ink" (#1C2530) for text to maintain high contrast with a softer, premium feel.
- **The Brass Accent:** Used sparingly for primary actions, focus states, and signifying high-value metadata. It represents the "seal" of authority.
- **Functional Semantics:** Success and error states use desaturated, deep tones (Emerald and Oxblood) to maintain the formal atmosphere, avoiding "neon" or "playful" signals.
- **Borders:** Hairline dividers use #E7E1D8 in light mode to define sections without breaking the visual flow.

## Typography
The typographic system uses a high-contrast pairing to distinguish between "content" and "interface."
- **Editorial Layer:** Newsreader is utilized for headings and legal titles (e.g., *Section 420 of The Indian Penal Code*). It should be set with slightly tighter letter-spacing for large displays to maintain a cohesive, authoritative look.
- **System Layer:** Inter provides a functional, neutral counterpoint for data entry, navigation, and metadata. 
- **Scale:** On desktop, the body text is slightly larger than standard (15px/18px) to accommodate long-form reading of statutes and clauses. Labels are often set in uppercase with increased tracking to denote metadata sections.

## Layout & Spacing
This design system employs a **Fixed-Fluid Hybrid Grid**. The primary content container is capped at 1440px to ensure line lengths for legal text do not become unreadable.
- **Rhythm:** A 4px baseline grid ensures vertical consistency. 
- **Document Focus:** The layout prioritizes a "Center-Stage" philosophy. Sidebars for navigation and document properties are secondary, often utilizing subtle background shifts to recede visually.
- **Desktop Strategy:** 12-column grid for dashboards; 8-column centered layout for focused document drafting.
- **Margins:** Generous page margins (48px) create a gallery-like feeling, emphasizing the importance of the legal artifacts within.

## Elevation & Depth
Elevation is handled with extreme subtlety to maintain the flat, "paper" aesthetic.
- **Tonal Depth:** Depth is primarily signaled through background color shifts (e.g., a slightly darker tint of the paper color for sidebars) rather than heavy shadows.
- **Shadows:** When necessary for modals or dropdowns, use "Ambient Ink Shadows"—very low opacity (4-8%), large blur radius (20px+), with a slight #1C2530 tint to avoid a "muddy" grey appearance.
- **Dividers:** Hairline strokes (1px or 0.5px) are the primary tool for separation, creating a structured, architectural feel without physical weight.

## Shapes
The shape language balances the sharpness of legal professionalism with modern software approachability. 
- **Standard Radius:** 8px (0.5rem) is the default for buttons, cards, and input fields.
- **Large Radius:** 16px (1rem) is reserved for major layout containers like document previews.
- **Interactive Elements:** Buttons should feel architectural; avoid pill shapes in favor of the standard 8px radius to keep the "formal" tone.

## Components
- **Buttons:** Primary buttons use the Ink (#1C2530) background with White text. Secondary buttons use a Hairline border with the Brass (#9A7B4F) text. Minimalist hover states involve a slight background tint or 1px vertical lift.
- **Legal Cards:** Used for case files or statutes. They feature a Hairline border, Newsreader titles, and a Brass "status indicator" (e.g., *Pending Review*).
- **Input Fields:** Unfilled, using only a bottom Hairline border or a very subtle 4-sided border in #E7E1D8. Labels are always `label-md` (uppercase) positioned above the field.
- **Lists:** High-density lists (e.g., *Clause 1.1, Clause 1.2*) use subtle zebra-striping with the #FAF8F5 and a 2% darker tint for contrast.
- **Chips:** Small, rectangular tags with 4px radius, using desaturated background tints of the primary colors for categorization (e.g., "Tax Law", "Litigation").
- **Placeholders:** Use specific Indian legal context, e.g., "e.g., Writ Petition No. 123 of 2023" or "Enter PAN/GSTIN".