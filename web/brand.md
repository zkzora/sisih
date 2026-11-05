# Sisih — brand direction

Recommended direction, selected under the user's instruction to determine the branding. Created 5 November 2026 (Asia/Jakarta). The approved direction is applied to the English Sisih dashboard. Financial activity is simulated.

## Product and audience

Sisih protects money committed to onchain obligations while an AI agent spends only uncommitted funds. Audience: builders and power users funding paid AI services. Fiat rent, electricity and bank bill payments are outside the supplied product scope.

Promise: "Protect commitments. Give your agent room."
Functional description: "Commitments protected. Your agent spends only what is left."
English descriptor: "Protect commitments. Let agents spend the rest."

## Logo

`sisih-icon.png`: companion standalone transparent symbol.

`sisih-logo.png`: lowercase wordmark with an abstract s made from two separated rounded pieces. The negative space represents setting funds aside. Use the standalone symbol for app icons, the horizontal lockup for headers. Transparent RGBA raster generated using the built-in image generation tool. It is not a vector master; typography is a custom generated wordmark rather than a font file. Brand color below is authoritative for future vector artwork.

Keep clear space of at least one i-dot diameter around the lockup. Minimum suggested width: 112px for lockup, 24px for symbol. Verify at the actual deployment size. No stretching, effects or unrelated container around the master. A trademark clearance has not been performed.

## Palette — Calm Allocation

Light first, calm, precise, human. Warm ivory canvas; white working surfaces; forest primary; lime for uncommitted funds. Approximate surface balance: 75% ivory/white, 20% forest/ink, 5% lime. No gradients are required.

| Token | Hex | OKLCH |
|---|---|---|
| background | `#F6F7F2` | `oklch(0.97399 0.00668 115.704)` |
| foreground | `#14231F` | `oklch(0.24105 0.02197 175.790)` |
| card | `#FFFFFF` | `oklch(1.00000 0.00000 89.876)` |
| card-foreground | `#14231F` | `oklch(0.24105 0.02197 175.790)` |
| popover | `#FFFFFF` | `oklch(1.00000 0.00000 89.876)` |
| popover-foreground | `#14231F` | `oklch(0.24105 0.02197 175.790)` |
| primary | `#164E43` | `oklch(0.38438 0.06059 177.247)` |
| primary-foreground | `#FFFFFF` | `oklch(1.00000 0.00000 89.876)` |
| secondary | `#E8EEE6` | `oklch(0.94234 0.01239 137.785)` |
| secondary-foreground | `#164E43` | `oklch(0.38438 0.06059 177.247)` |
| muted | `#EDF1EA` | `oklch(0.95316 0.01020 131.360)` |
| muted-foreground | `#59665F` | `oklch(0.49697 0.01935 162.175)` |
| accent | `#D6F36B` | `oklch(0.91639 0.16437 119.830)` |
| accent-foreground | `#14231F` | `oklch(0.24105 0.02197 175.790)` |
| destructive | `#B33D3A` | `oklch(0.52785 0.15399 25.372)` |
| destructive-foreground | `#FFFFFF` | `oklch(1.00000 0.00000 89.876)` |
| border | `#BCC8BE` | `oklch(0.82066 0.01904 150.500)` |
| input | `#A5B3A7` | `oklch(0.75231 0.02301 149.607)` |
| ring | `#164E43` | `oklch(0.38438 0.06059 177.247)` |
| reserved | `#526B65` | `oklch(0.50585 0.03107 178.652)` |
| available | `#D6F36B` | `oklch(0.91639 0.16437 119.830)` |
| available-foreground | `#14231F` | `oklch(0.24105 0.02197 175.790)` |
| success | `#16624A` | `oklch(0.44447 0.08234 167.005)` |
| success-soft | `#E5F3EA` | `oklch(0.95122 0.01901 157.867)` |
| warning | `#8A4F0F` | `oklch(0.48704 0.10661 60.889)` |
| warning-soft | `#FFF0D9` | `oklch(0.96098 0.03432 78.680)` |
| danger | `#B33D3A` | `oklch(0.52785 0.15399 25.372)` |
| danger-soft | `#FCEDEA` | `oklch(0.95712 0.01682 31.083)` |
| memory | `#465F95` | `oklch(0.49072 0.09218 264.410)` |
| memory-soft | `#EBEFFB` | `oklch(0.95259 0.01668 271.240)` |

Full light and dark tokens are in `tokens.css` and `palette.json`. The palette is applied in src/app/tokens.css and src/app/globals.css. Original reference files remain in design/sisih-brand/.

## Semantic use

- Forest #164E43: logo, primary actions, selected navigation.
- Lime #D6F36B with ink text: money available to the agent, not a generic success status. Never white text on lime, and never lime text on white.
- Slate #526B65: reserved money. Use lock icon and explicit text as well as color.
- Blue #465F95 on #EBEFFB: recalled memory and learned rules; not every integration badge.
- Amber #8A4F0F on #FFF0D9: needs review, pending memory, low funds.
- Red #B33D3A on #FCEDEA: hard-boundary violation, failed transaction, underfunded obligation. Refused spending is not the same as a network failure; explain the reason.
- Green #16624A on #E5F3EA: confirmed payment or completed write; never claim confirmation from a queued request.

## Typography

DM Sans for titles and interface copy; Geist Mono for wallet addresses, hashes and compact numeric labels. Large balances use DM Sans with tabular numerals. Dashboard default text 14px, section titles 18px, page title 30–32px, primary available balance 56–64px. Metadata can use 12px with sufficient contrast. Logo lettering remains the generated custom wordmark.

## Website application

`preview.html`: local brand board with logo, palette, typography, reference links, light/dark sample and a static overview dashboard. `dashboard.html`: desktop application direction. All balances, requests, network indicators and timestamps are explicitly demo examples; no wallet or API connection exists in the preview.

Dashboard: 224px sidebar, 24–32px main gutters, 12px card radii, light separators, one clearly dominant available-funds figure. Show total = reserved + available on the first screen. Sample uses 20.00 = 16.50 + 3.50 USDC. Heavy integration detail belongs in the onchain and memory views, with compact statuses in the header. Reserve and free funds have distinct surfaces and labels.

Landing page: clear functional headline, real product screenshot as primary illustration, one CTA to open demo, a three-step explanation (reserve -> give permission -> spend the remainder), then inspectable evidence. Avoid invented traction, bank insurance language, yield promises or security guarantees.

## Voice

Use concise English throughout the application. Examples: Committed, Available to your agent, Needs your decision, and Reserves stay protected. Explain the exact amount, applicable rule, and next available action. Avoid guilt about spending.

## Reference websites

- Mercury demo: https://demo.mercury.com/dashboard — hierarchy of balances, persistent navigation and transaction density. Visual reference only.
- Ramp spend management: https://ramp.com/spend-management — spend review, policies, merchant context and approval detail.
- Monzo Pots: https://monzo.com/features/pots — intelligible fund separation and labels for allocated money. Sisih does not inherit banking features or deposit protection from this reference.
- Linear: https://linear.app — request lists, compact metadata and detail panels.

Use these as references for specific interface decisions; keep Sisih's own mark, palette and composition.

## Verification

`contrast-check.json` contains calculated sRGB contrast ratios for both token sets. Body text pairs pass 4.5:1, primary/focus visibility 3:1, structural border target 1.5:1. This token check is not a complete WCAG audit of a future application. Status also uses text and icons. Brand typography and layout should be checked in the final app.

