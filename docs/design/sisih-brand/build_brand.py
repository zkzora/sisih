from pathlib import Path
import json, math, shutil

ROOT = Path(__file__).resolve().parent
ROOT.mkdir(parents=True, exist_ok=True)
SOURCE = Path(r'C:\Users\Pongo\.codex\generated_images\01a1a8c9-c248-7973-a2f1-0722ad5329da\exec-67bd7ecd-3b79-4eb8-ae27-4c3b25c0c422.png')
shutil.copy2(SOURCE, ROOT / 'sisih-logo.png')

light = {
 'background':'#F6F7F2','foreground':'#14231F','card':'#FFFFFF','card-foreground':'#14231F',
 'popover':'#FFFFFF','popover-foreground':'#14231F','primary':'#164E43','primary-foreground':'#FFFFFF',
 'secondary':'#E8EEE6','secondary-foreground':'#164E43','muted':'#EDF1EA','muted-foreground':'#59665F',
 'accent':'#D6F36B','accent-foreground':'#14231F','destructive':'#B33D3A','destructive-foreground':'#FFFFFF',
 'border':'#BCC8BE','input':'#A5B3A7','ring':'#164E43','reserved':'#526B65','available':'#D6F36B','available-foreground':'#14231F',
 'success':'#16624A','success-soft':'#E5F3EA','warning':'#8A4F0F','warning-soft':'#FFF0D9',
 'danger':'#B33D3A','danger-soft':'#FCEDEA','memory':'#465F95','memory-soft':'#EBEFFB',
}
dark = {
 'background':'#111D18','foreground':'#F1F5EE','card':'#192922','card-foreground':'#F1F5EE',
 'popover':'#20332A','popover-foreground':'#F1F5EE','primary':'#D6F36B','primary-foreground':'#14231F',
 'secondary':'#273B30','secondary-foreground':'#F1F5EE','muted':'#213329','muted-foreground':'#A9B8AC',
 'accent':'#324930','accent-foreground':'#E7F4BC','destructive':'#FFB4AA','destructive-foreground':'#401410',
 'border':'#3B5043','input':'#66816D','ring':'#D6F36B','reserved':'#99B5A5','available':'#D6F36B','available-foreground':'#14231F',
 'success':'#A2D7B7','success-soft':'#183C2C','warning':'#F3CD81','warning-soft':'#352A15',
 'danger':'#FFB4AA','danger-soft':'#3A2020','memory':'#B8C9FF','memory-soft':'#202D45',
}

def rgb(h): return [int(h[i:i+2],16)/255 for i in (1,3,5)]
def linear(c): return c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4
def luminance(h):
 r,g,b=map(linear,rgb(h)); return .2126*r+.7152*g+.0722*b
def contrast(a,b):
 x,y=sorted((luminance(a),luminance(b))); return (y+.05)/(x+.05)
def oklch(h):
 r,g,b=map(linear,rgb(h))
 l=(.4122214708*r+.5363325363*g+.0514459929*b)**(1/3)
 m=(.2119034982*r+.6806995451*g+.1073969566*b)**(1/3)
 s=(.0883024619*r+.2817188376*g+.6299787005*b)**(1/3)
 L=.2104542553*l+.7936177850*m-.0040720468*s
 a=1.9779984951*l-2.4285922050*m+.4505937099*s
 z=.0259040371*l+.7827717662*m-.8086757660*s
 C=math.hypot(a,z); H=math.degrees(math.atan2(z,a))%360
 return f'oklch({L:.5f} {C:.5f} {H:.3f})'

pairs=[('foreground','background',4.5),('foreground','card',4.5),('foreground','popover',4.5),
 ('foreground','muted',4.5),('muted-foreground','background',4.5),('muted-foreground','card',4.5),
 ('primary-foreground','primary',4.5),('secondary-foreground','secondary',4.5),
 ('accent-foreground','accent',4.5),('destructive-foreground','destructive',4.5),
 ('primary','background',3),('ring','background',3),('border','background',1.5),
 ('success','success-soft',4.5),('warning','warning-soft',4.5),('danger','danger-soft',4.5),
 ('memory','memory-soft',4.5),('available-foreground','available',4.5)]
report={}
for name,tokens in [('light',light),('dark',dark)]:
 report[name]=[]
 for fg,bg,minimum in pairs:
  value=contrast(tokens[fg],tokens[bg]); passed=value>=minimum
  report[name].append({'foreground':fg,'background':bg,'ratio':round(value,2),'minimum':minimum,'pass':passed})
  assert passed, f'{name} {fg}/{bg} fails: {value:.2f}'

css='/* Sisih / Calm Allocation / 2026-11-05. Reference tokens; no app has been themed. */\n'
for selector,tokens in [(':root',light),('.dark',dark)]:
 css += selector+' {\n'
 css += ''.join(f'  --{key}: {oklch(value)}; /* {value} */\n' for key,value in tokens.items())
 css += '  --radius: 0.75rem;\n  --font-sans: "DM Sans", sans-serif;\n  --font-mono: "Geist Mono", monospace;\n}\n\n'
(ROOT/'tokens.css').write_text(css,encoding='utf-8')
(ROOT/'palette.json').write_text(json.dumps({'name':'Calm Allocation','light':light,'dark':dark},indent=2),encoding='utf-8')
(ROOT/'contrast-check.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
rows='\n'.join(f'| {k} | `{v}` | `{oklch(v)}` |' for k,v in light.items())
notes=f'''# Sisih — brand direction

Recommended direction, selected under the user's instruction to determine the branding. Created 5 November 2026 (Asia/Jakarta). This package is a logo and visual direction, not a functioning financial application.

## Product and audience

Sisih protects money committed to onchain obligations while an AI agent spends only uncommitted funds. Audience: builders and power users funding paid AI services. Fiat rent, electricity and bank bill payments are outside the supplied product scope.

Promise: "Sisihkan yang wajib. Beri agen ruang."
Functional description: "Dana kewajiban terlindungi. Agen hanya memakai sisanya."
English descriptor: "Protect commitments. Let agents spend the rest."

## Logo

`sisih-logo.png`: lowercase wordmark with an abstract s made from two separated rounded pieces. The negative space represents setting funds aside. Use the standalone symbol for app icons, the horizontal lockup for headers. Transparent RGBA raster generated using the built-in image generation tool. It is not a vector master; typography is a custom generated wordmark rather than a font file. Brand color below is authoritative for future vector artwork.

Keep clear space of at least one i-dot diameter around the lockup. Minimum suggested width: 112px for lockup, 24px for symbol. Verify at the actual deployment size. No stretching, effects or unrelated container around the master. A trademark clearance has not been performed.

## Palette — Calm Allocation

Light first, calm, precise, human. Warm ivory canvas; white working surfaces; forest primary; lime for uncommitted funds. Approximate surface balance: 75% ivory/white, 20% forest/ink, 5% lime. No gradients are required.

| Token | Hex | OKLCH |
|---|---|---|
{rows}

Full light and dark tokens are in `tokens.css` and `palette.json`. They are reference assets only; no app stylesheet was changed.

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

Use concise Indonesian: "Dijanjikan", "Bebas dipakai agen", "Perlu ditinjau", "Cadangan tetap terlindungi". Use neutral explanations rather than guilt about spending. Show the exact amount, applicable rule and next available action. Product example: "Permintaan 3,00 USDC ditahan. Dana bebas 1,80 USDC; cadangan tidak dapat dipakai agen."

## Reference websites

- Mercury demo: https://demo.mercury.com/dashboard — hierarchy of balances, persistent navigation and transaction density. Visual reference only.
- Ramp spend management: https://ramp.com/spend-management — spend review, policies, merchant context and approval detail.
- Monzo Pots: https://monzo.com/features/pots — intelligible fund separation and labels for allocated money. Sisih does not inherit banking features or deposit protection from this reference.
- Linear: https://linear.app — request lists, compact metadata and detail panels.

Use these as references for specific interface decisions; keep Sisih's own mark, palette and composition.

## Verification

`contrast-check.json` contains calculated sRGB contrast ratios for both token sets. Body text pairs pass 4.5:1, primary/focus visibility 3:1, structural border target 1.5:1. This token check is not a complete WCAG audit of a future application. Status also uses text and icons. Brand typography and layout should be checked in the final app.
'''
(ROOT/'brand.md').write_text(notes,encoding='utf-8')
print(json.dumps({'output':str(ROOT),'contrast_pairs_checked':sum(len(v) for v in report.values()),'all_pass':True},indent=2))
