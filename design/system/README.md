# wmhb

Video guestbook hire in Auckland and Hamilton. What My Husband Builds (wmhb) brings a vintage phone and a video guestbook board to weddings, birthdays and events, and sends every guest's message to the host afterwards. This system holds the brand's colours, type and shapes, so the enquiry form, cards and signs all look like one business.

## How we sound

Warm, plain and direct, like a husband and wife who built the thing themselves.

- **NZ English.** Short sentences. No hype words, no em dashes.
- **Headlines are lowercase and heavy:** "wedding packages", "how to book", "check your date".
- **Everything else is sentence case.** No all-caps labels.
- **Buttons say what happens:** "Send enquiry", "Check my date". Never "Submit".
- **Errors say what to fix:** "Add your event date so we can check it's free." Never "Invalid input".

## Colour

Two colours carry the brand: **yellow** and **ink**. Everything else supports them.

| Token | Hex | Use it for |
|---|---|---|
| `yellow` | #F1C22D | Fills only: header bands, the primary button, selected options |
| `yellow-soft` | #FBEDB8 | Hover and highlighted rows |
| `ink` | #1C1B15 | Text, headings, the wordmark, the ruler, button borders, focus ring |
| `ink-muted` | #5C5A50 | Hints, helper text and footer notes on paper or surface |
| `ink-muted-on-yellow` | #4D4220 | Secondary text on yellow |
| `paper` | #FAFAF7 | Page background |
| `surface` | #FFFFFF | Form panels and input fields |
| `line` | #E2DFD5 | Decorative dividers and panel outlines |
| `field-border` | #8A8576 | Borders of inputs, selects and unselected chips |
| `placeholder` | #6E6A5D | Example text inside empty fields |
| `error` / `error-soft` | #B42318 / #FDEDEA | Problems with a field, and the error summary |
| `success` / `success-soft` | #1D7A4A / #E8F4EC | The enquiry-sent message |
| `wine` / `blush` | #5A1820 / #F6E8E4 | Wedding signs and themed screens only |

**Rules**

- **Yellow is a fill, never a text colour.** Yellow on paper is only 1.6:1, so it can't carry text, thin lines or icons. Put `ink` text on it (10.3:1).
- **One yellow moment per area.** A yellow header band or a yellow button, plus selected states. Don't stack yellow panels.
- **Controls use `field-border`.** `line` is for decoration only and is too light for anything people click or type in.
- **Never colour alone.** A selected chip gets a yellow fill and an ink border. An error gets an `error` border and a written message.
- **Wine and blush are the event colours.** They match the guestbook board's lettering and the wedding signs. Use them on wedding-facing pages and print, never in the same component as yellow.

**Checked pairs** (WCAG AA needs 4.5:1 for text, 3:1 for control borders and focus rings)

| Pair | Ratio |
|---|---|
| `ink` on `paper` | 16.5:1 |
| `ink` on `yellow` | 10.3:1 |
| `ink-muted` on `surface` | 6.9:1 |
| `ink-muted-on-yellow` on `yellow` | 5.9:1 |
| `placeholder` on `surface` | 5.4:1 |
| `error` on `surface` | 6.6:1 |
| `success` on `success-soft` | 4.7:1 |
| `field-border` on `surface` | 3.7:1 |
| `wine` on `blush` | 11.1:1 |
| `yellow` on `paper` | 1.6:1, fill only |

## Type

**Inter Tight** for everything, from the 900-weight headlines to the 14px hints. The file is in `fonts/`, and it's on Google Fonts too.

| Style | Size / leading | Weight | For |
|---|---|---|---|
| `display` | 72 / 0.9, tracking −0.05em | 900 | One lowercase headline per page (48px on phones) |
| `heading` | 36 / 1.05, tracking −0.03em | 900 | Lowercase section headings |
| `lead` | 22 / 1.35 | 600 | The line under a headline |
| `body` | 17 / 1.5 | 500 | Paragraphs and typed text |
| `label` | 16 / 1.3 | 700 | Field labels |
| `hint` | 14 / 1.4 | 500 | Help text, error messages, footer notes |
| `button` | 17 / 1 | 800 | Button text |

**The wordmark** is "wmhb" set in Inter Tight 900 with letter-spacing −0.1024em, with the ruler centred underneath. On screens, type it live rather than using an image. For avatars and email, use the files in Logos.

## Shapes

- **The ruler.** A horizontal bar with ticks hanging from it: long at both ends, then short, medium, short, long, repeating. It sits under the wordmark and runs across the page above footers, like the bottom of every pricing card. It's the brand's one decoration.
- **Corners.** `radius-md` (4px) for buttons, fields, panels and bands. `radius-pill` for chips. `radius-sm` for small tags.
- **Flat.** No drop shadows or gradients. The only shadow is `focus-ring`.
- **Ticks and dashes** show what's included and what isn't, as on the package tables.

## Applying it to the enquiry form

- **Page:** `paper` background.
- **Header:** a `yellow` band with the wordmark, a `display` headline in `ink` ("check your date") and a `lead` line in `ink-muted-on-yellow`.
- **Form panel:** `surface`, 1px `line` outline, `radius-md`, padding `space-3` on phones and `space-4` on larger screens.
- **Labels:** `label` style in `ink`, above the field, with a `space-1` gap. Hints under the label in `hint` style, `ink-muted`.
- **Fields:** `surface` fill, 1.5px `field-border`, `radius-md`, at least 48px tall, `body` text in `ink`, placeholders in `placeholder`.
- **Focus:** the `focus-ring` shadow on every control.
- **Event type chips:** `radius-pill`. Unselected: `surface` with a `field-border` outline. Selected: `yellow` fill, 1.5px `ink` border, `ink` text.
- **Errors:** the field border turns `error` and the message appears underneath in `hint` style, `error` colour. For several errors, add a summary at the top on `error-soft`.
- **Primary button:** `yellow` fill, 2px `ink` border, `ink` text in `button` style, full width on phones. Hover: swap to an `ink` fill with `yellow` text. Disabled: `line` fill with `ink-muted` text and no border.
- **Sent:** replace the form with a `success-soft` panel, a `heading` in `success` ("enquiry sent") and a `body` line saying what happens next.
- **Footer:** the ruler in `ink` across the page, then notes in `hint` style, `ink-muted`.

## Don't

- Yellow text, or yellow lines and icons on paper.
- Gradients, drop shadows or glows.
- Yellow and wine in the same component.
- All-caps labels or headlines.
