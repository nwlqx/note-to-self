# note to self: design system

The look is a paper notebook: warm off-white paper, soft ink, pastel highlighter
colours, serif headings and the odd handwritten note. The rules below keep it
consistent. All tokens live at the top of `src/styles.css`.

## Built on Open Props

[Open Props](https://open-props.style) supplies the shared scales. `build.mjs` loads
`sizes` and `easings` from `node_modules/open-props` before `styles.css`. The app's
own tokens sit on top of them. Open Props' colours, fonts and buttons are not used:
those are ours.

## Typefaces

| Token | Font | Use |
| --- | --- | --- |
| `--font-display` | Instrument Serif | Page titles, quadrant names, big numbers |
| `--font-sans` | DM Sans | Everything else |
| `--font-hand` | Caveat | Small handwritten accents only |

## Type scale

Every `font-size` uses one of these steps. Use `em` only for text sized relative to its parent.

| Token | Size | Typical use |
| --- | --- | --- |
| `--text-2xs` | 12px | Tiny labels, counts |
| `--text-xs` | 13px | Hints, meta lines, small buttons |
| `--text-sm` | 14px | Secondary buttons, task titles in cards |
| `--text-md` | 15px | List rows |
| `--text-base` | 16px | Body text, inputs |
| `--text-lg` | 18px | |
| `--text-xl` | 22px | Section headings |
| `--text-2xl` | 24px | |
| `--text-3xl` | 28px | Quadrant names |
| `--text-4xl` | 32px | Page titles |
| `--text-5xl`–`--text-8xl` | 40–72px | Display numbers, the greeting |

## Control heights

Every button, input and chip sets its `min-height` to one of these.

| Token | Height | Use |
| --- | --- | --- |
| `--control-xs` | 28px | Quiet inline actions (a card's "+ Add") |
| `--control-sm` | 32px | Compact buttons, chips, text links |
| `--control-md` | 40px | Standard buttons, inputs, segmented controls |
| `--control-lg` | 44px | Main touch targets |

## Spacing and shape

- Spacing `--s1`…`--s7` = 4, 8, 12, 16, 24, 32, 48px, mapped onto Open Props `--size-*` (12px is ours).
- Radius `--radius-sm` 8, `--radius-md` 14, `--radius-lg` 22, `--radius-pill`.
- Motion: transitions use Open Props `--ease-*` curves and stay short (120–150ms). Each one has a `prefers-reduced-motion` fallback.

## Colour

- Neutrals: `--paper`, `--paper-raised`, `--surface-sunken`, `--ink`, `--ink-soft`, `--ink-faint`, `--rule`, `--rule-strong`.
- Highlighters: `--pink`, `--yellow`, `--pistachio`, `--snow`, `--lavender`, `--rose`. Each has `-soft` and `-ink` variants, and `--on-*` for text on top.
- Every colour has a dark-mode value. Never hard-code a hex in a component rule.

## Buttons

Pick one of these; don't style a new button from scratch.

| Class | Looks like | Use |
| --- | --- | --- |
| `.primary` | Solid ink pill | The one main action in a sheet |
| `.secondary` | Outlined pill | Other actions |
| `.text-btn` | Underlined text (`.small`, `.quiet`, `.danger`) | Links such as "All projects", "Add task", "3 more" |
| `.icon-btn` | Round icon | Toolbars, close |
| `.chip` | Soft pill with dot | Filters, toggles |
| `.seg` | Segmented control | Choosing one of a few views |
| `.inline-add` | "+ Add" | Quick add inside a list or card |
