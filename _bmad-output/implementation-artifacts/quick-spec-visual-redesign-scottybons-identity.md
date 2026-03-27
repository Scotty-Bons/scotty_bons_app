# Quick Spec: Visual Redesign — ScottyBons App Identity

## Change Summary

Redesign all screens to match the visual identity delivered by the designer (Login + Home mockups). This is a **design-only** change — no functionality, routes, data models, or business logic change. The goal is to transform the current shadcn/ui default aesthetic into the warm, mobile-first, card-based ScottyBons brand identity shown in the mockups.

## Current State

- Generic shadcn/ui "New York" style — neutral grays, small border-radius, flat cards
- Desktop-first sidebar navigation layout
- Login: plain centered card with logo + form, no hero image, no social login styling
- Dashboard pages: table-heavy, utilitarian, no visual warmth
- Inputs: standard `h-9` height, `rounded-md` (4px effective), no icons inside
- Buttons: `rounded-md`, small padding, generic primary
- Cards: `rounded-xl` with thin border, minimal shadow
- Background: warm cream `hsl(36, 100%, 95%)` — already close, but underused
- Color tokens exist (`--primary: 38 91% 55%`) but usage is minimal and inconsistent

## Target State (from designer mockups)

### Design Tokens / Global Theme

| Token | Current | Target | Notes |
|-------|---------|--------|-------|
| `--primary` | `38 91% 55%` | `32 95% 58%` | Slightly more saturated warm orange (≈ `#F5A623`) |
| `--primary-foreground` | `0 0% 9%` | `0 0% 100%` | White text on orange buttons |
| `--background` | `36 100% 95%` | `0 0% 97%` | Lighter, more neutral white-gray |
| `--card` | `0 0% 100%` | `0 0% 100%` | Keep white |
| `--radius` | `0.5rem` | `0.75rem` | Larger base radius; buttons get `rounded-full` |
| `--input` | `0 0% 89.8%` | `0 0% 93%` | Slightly lighter input borders |
| New: `--primary-light` | — | `32 100% 95%` | Light orange tint for badge backgrounds, hover states |

### Typography

| Element | Current | Target |
|---------|---------|--------|
| Page headings | `text-2xl font-semibold` | `text-2xl font-bold` — darker, bolder |
| Section headings | `text-lg` | `text-lg font-semibold` |
| Body text | `text-sm` | `text-sm` (keep) |
| Branding | Plain logo image | "scottybons**app**" text style if needed alongside logo |

### Button Styles

| Variant | Current | Target |
|---------|---------|--------|
| **default (CTA)** | `rounded-md bg-primary h-9` | `rounded-full bg-primary h-11 text-white font-semibold shadow-md` |
| **outline** | thin border, `rounded-md` | `rounded-full border-2 border-primary text-primary bg-white` |
| **ghost** | transparent hover gray | Keep, increase padding |
| **social** (new) | — | `rounded-full border border-gray-300 bg-white h-11 font-medium` with brand icon |

### Input Styles

| Property | Current | Target |
|----------|---------|--------|
| Height | `h-9` | `h-12` |
| Border radius | `rounded-md` | `rounded-xl` (12px) |
| Background | transparent | `bg-gray-50` (light fill) |
| Left icon | None | Support optional leading icon (Mail, Lock, etc.) |
| Label | Above input | Above input (keep), lighter weight |

### Card Styles

| Property | Current | Target |
|----------|---------|--------|
| Border radius | `rounded-xl` | `rounded-2xl` (16px) |
| Shadow | `shadow` (small) | `shadow-sm` for list items, `shadow-md` for CTA cards |
| Border | `border` (1px gray) | `border border-gray-100` — subtler |
| Padding | `p-6` | `p-4` for compact cards, `p-5` for section cards |

### Badge / Status Pill Styles

| Property | Current | Target |
|----------|---------|--------|
| Shape | `rounded-full` (OK) | Keep `rounded-full` |
| Colors | Secondary gray | Orange outlined: `border-primary text-primary bg-primary-light` |
| Size | default | `text-xs px-2.5 py-0.5` |

---

## Implementation Plan

### Phase 1: Design Tokens & Base Components (foundation)

**Files to modify:**

1. **`app/globals.css`** — Update CSS custom properties:
   - Adjust `--primary` hue/saturation to match mockup orange
   - Add `--primary-light` token
   - Change `--primary-foreground` to white
   - Adjust `--background` to neutral near-white
   - Increase `--radius` to `0.75rem`

2. **`components/ui/button.tsx`** — Redesign variants:
   - Default variant: `rounded-full h-11 font-semibold shadow-md`
   - Add `social` variant: `rounded-full border border-gray-200 bg-white h-11`
   - Adjust all size variants to be taller (h-10 min for `sm`, h-11 for `default`, h-12 for `lg`)
   - Keep `icon` sizes as-is

3. **`components/ui/input.tsx`** — New input style:
   - Increase height to `h-12`
   - Change radius to `rounded-xl`
   - Add `bg-muted/50` background fill
   - Add support for optional `leftIcon` prop (render icon inside with `pl-10`)

4. **`components/ui/card.tsx`** — Softer cards:
   - Change `rounded-xl` to `rounded-2xl`
   - Reduce default border to `border-gray-100`
   - Adjust padding in CardHeader/CardContent to `p-4` / `p-5`

5. **`components/ui/badge.tsx`** — Add `status` variant improvements:
   - Orange outlined style: `border-primary text-primary bg-[hsl(var(--primary-light))]`

### Phase 2: Auth Screens

**Files to modify:**

6. **`app/(auth)/login/page.tsx`** — New login layout:
   - Full-height single-column layout
   - Top section: hero image with food photography + overlaid logo
   - Bottom section: white card area with form (scrollable on small screens)
   - Add hero image asset: `public/login-hero.jpg` (food photography, designer to provide)

7. **`components/login-form.tsx`** — Redesign form:
   - "Welcome back!" heading (bold) + "Log in to restock your inventory." subtitle
   - Email input with Mail icon on left
   - Password input with Lock icon on left + Eye toggle on right
   - "Forgot your password?" link in orange, right-aligned
   - Full-width `rounded-full` orange Login button
   - "or log in with" divider (line — text — line)
   - Google + Apple social buttons side by side (using new `social` variant)
   - "Don't have an account yet? **Create new account**" footer link

8. **`components/sign-up-form.tsx`** — Match login visual style

9. **`components/forgot-password-form.tsx`** — Match login visual style

10. **`components/update-password-form.tsx`** — Match login visual style

### Phase 3: Dashboard Layout Redesign

**Files to modify:**

11. **`app/(dashboard)/layout.tsx`** — Mobile-first layout:
    - On mobile (`< md`): no sidebar, use bottom tab navigation or top header only
    - On desktop (`≥ md`): keep sidebar but restyle to match identity
    - Add bottom padding on mobile to account for bottom nav if used

12. **`components/shared/sidebar.tsx`** — Visual refresh:
    - White background instead of `bg-muted/30`
    - Active item: orange left accent bar + `bg-primary-light` + orange text
    - Inactive items: `text-gray-500` (softer)
    - Logo area: add subtle bottom separator

13. **`components/shared/header.tsx`** — Cleaner header:
    - White background
    - User avatar/initials in orange circle (already present, keep)
    - "Logout" text link in orange with exit icon (as in mockup)

14. **`components/shared/user-menu.tsx`** — Simplify:
    - Show store name + email prominently (as in mockup top bar)
    - Orange "Logout" link instead of dropdown menu option

### Phase 4: Home / Orders Screens (store role)

**Files to modify:**

15. **`app/page.tsx`** — Redesign store landing page:
    - Hero CTA card: large `rounded-2xl bg-primary` with "Place a new order" + "Restock your inventory" + cart icon → links to `/orders/new`
    - "Recent Orders" section with order cards (see below)
    - Quick-access grid: "Store Checklists" + "Invoices" side by side cards with icons
    - "Repeat last order?" card at bottom with "Add" button

16. **`app/(dashboard)/orders/page.tsx`** — Order list visual refresh:
    - Order cards instead of table rows (on mobile)
    - Each card: left icon (orange circle), order number, date, status badge, total, "Details >"
    - Keep table layout on desktop but with softer styling

17. **`components/orders/realtime-order-list.tsx`** — Card-based order items:
    - Orange circle icon per order
    - Status badge in orange outlined style ("In Transit", "Separating", etc.)
    - Arrival time in green/orange highlight
    - "Details >" as text link on right

18. **`components/orders/order-filters.tsx`** — Rounded filter pills

### Phase 5: Remaining Screens Polish

**Files to modify:**

19. **`app/(dashboard)/invoices/page.tsx`** — Match card-based list style
20. **`components/invoices/*`** — Orange icon accents, rounded cards

21. **`app/(dashboard)/audits/page.tsx`** — Match card-based list style
22. **`components/audits/*`** — Orange icon accents, rounded cards

23. **`app/(dashboard)/products/page.tsx`** — Catalog with softer card styling
24. **`components/products/*`** — Product cards with rounded images, warm style

25. **`app/(dashboard)/users/page.tsx`** — User list with card items
26. **`components/users/*`** — Form fields match new input style

27. **`app/(dashboard)/settings/page.tsx`** — Settings form polish
28. **`components/settings/*`** — Match new input/button style

29. **`app/(dashboard)/dashboard/page.tsx`** — Admin dashboard:
    - Summary cards with orange accents / icons
    - Chart containers with `rounded-2xl` cards

### Phase 6: Assets & Final Polish

30. **`public/login-hero.jpg`** — Hero food photography for login screen (asset from designer)
31. **`public/logo_scottybons.png`** — Verify logo matches the one in mockup (orange pumpkin icon + text)
32. **Favicon / metadata** — Update if new branding assets available
33. **Loading states / spinners** — Use orange-colored spinner
34. **Empty states** — Add warm illustrations if designer provides

---

## Component Change Summary Table

| Component | File | Change Type |
|-----------|------|-------------|
| CSS tokens | `app/globals.css` | Modify tokens |
| Button | `components/ui/button.tsx` | Modify variants, add `social` |
| Input | `components/ui/input.tsx` | Add `leftIcon`, increase size, rounder |
| Card | `components/ui/card.tsx` | Rounder, softer border |
| Badge | `components/ui/badge.tsx` | Orange status variant |
| Login page | `app/(auth)/login/page.tsx` | New layout with hero |
| Login form | `components/login-form.tsx` | Full redesign |
| Sign-up form | `components/sign-up-form.tsx` | Match login style |
| Forgot password | `components/forgot-password-form.tsx` | Match login style |
| Update password | `components/update-password-form.tsx` | Match login style |
| Dashboard layout | `app/(dashboard)/layout.tsx` | Mobile-first nav |
| Sidebar | `components/shared/sidebar.tsx` | Visual refresh |
| Header | `components/shared/header.tsx` | Cleaner, white bg |
| User menu | `components/shared/user-menu.tsx` | Simplified logout |
| Home page | `app/page.tsx` | CTA hero + recent orders |
| Orders page | `app/(dashboard)/orders/page.tsx` | Card-based list |
| Order list | `components/orders/realtime-order-list.tsx` | Card items |
| Order filters | `components/orders/order-filters.tsx` | Rounded pills |
| Invoices page | `app/(dashboard)/invoices/page.tsx` | Card list style |
| Audits page | `app/(dashboard)/audits/page.tsx` | Card list style |
| Products page | `app/(dashboard)/products/page.tsx` | Softer cards |
| Users page | `app/(dashboard)/users/page.tsx` | Card list |
| Settings page | `app/(dashboard)/settings/page.tsx` | Form polish |
| Dashboard page | `app/(dashboard)/dashboard/page.tsx` | Orange accents |

## Out of Scope

- **No functionality changes** — all routes, APIs, data models, RLS, and business logic stay exactly as they are
- **No new pages or routes** — only visual restyling of existing screens
- **No dark mode redesign** — focus on light mode to match mockups; dark mode tokens auto-adjust
- **No third-party UI library swap** — continue using shadcn/ui + Tailwind, just restyle
- **Social login backends** — the Google/Apple buttons are visual only unless auth is already wired

## Dependencies / Blockers

- **Hero image asset** (`login-hero.jpg`): need the food photography from the designer. Can use a placeholder initially.
- **Logo confirmation**: verify `public/logo_scottybons.png` matches the mockup's orange pumpkin icon + "scottybonsapp" text. May need a new asset.
- **Quick-access icons**: "Store Checklists" and "Invoices" icon assets — can use Lucide icons styled in orange as fallback.

## Testing Approach

- Visual regression: manual comparison of each screen against mockup identity
- Responsive: test all screens at 375px (mobile), 768px (tablet), 1280px (desktop)
- Ensure all existing Playwright/e2e tests still pass (selectors by role/label shouldn't break if we only change styling)
- Verify dark mode doesn't break (even if not redesigned, tokens should cascade)

## Recommended Execution Order

1. **Phase 1 first** — tokens + base components ripple through everything automatically
2. **Phase 2 next** — login is the first screen users see, highest visual impact
3. **Phase 3** — layout shell affects every authenticated page
4. **Phase 4** — home + orders are the core workflow for store users
5. **Phase 5** — remaining screens follow naturally with base components already styled
6. **Phase 6** — final polish and asset swap

Estimated scope: ~30 files modified, 0 new pages, 0 database changes, 0 API changes.
