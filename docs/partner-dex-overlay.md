# Partner Dex Overlay for Trade Next

## Context
Sam and his wife trade the same Pokemon so both copies become lucky. By storing the partner's lucky dex alongside your own, the Trade Next view highlights which available Pokemon both players need (highest priority), only you need, or only your partner needs.

## UX Flow

### Setting a partner
**Share link path only (v1)**: Wife shares link → Sam opens it → banner asks "Whose list is this?" with "Mine" / "My partner's" → saves partner dex with name "Partner" → auto-navigates to Trade Next tab → toast shows both-need count.

If a partner already exists, the "My partner's" button says "Update partner" instead.

If the user has no list of their own yet, "My partner's" / "Update partner" is disabled and hidden. Banner shows: "You don't have your own list yet — import this as yours first."

### Import banner (two-step)
Step 1: "Shared link detected with **X** lucky entries. Whose list is this?"
- **"Mine"** → existing import flow (with confirmation if diff > 20%)
- **"My partner's"** / **"Update partner"** → saves immediately as partner, no name prompt (defaults to "Partner")

### Trade Next cards — left border indicators
- **Both need**: `border-l-4 border-amber-400` + "Both need" pill badge
- **Only you**: no extra border (the "Showing trades for you + Partner" header conveys partner-aware state)
- **Only partner**: `border-l-4 border-blue-200` + "Partner" pill badge, full opacity

### List header indicator
When partner is set, show above the 2x2 grid: "Showing trades for you + Partner" — makes partner-aware state visible at a glance.

### Progress bar area — merged partner indicator
"You: 487/1025 lucky · Partner: 512/1025 · Updated Feb 14"

### Change feedback toast
After setting/updating partner: "Partner dex saved! **12 Pokemon** you both need are available right now." Auto-dismiss 5s. Auto-navigate to Trade Next tab so the toast appears in context.

### Overwrite protection
- When "Mine" selected and incoming dex differs by >20% (diff = symmetric difference / max(currentSize, 1)): confirmation dialog "You already have a list with X entries. Replace it?"
- When `hasPartner` is true AND incoming differs materially (>5%): confirm on "Mine" with copy "Did you mean to set this as Partner instead?" since "My partner's" is the more likely intent.

## Storage

localStorage key: `"lucky-pgo-partner-dex"`

```typescript
interface PartnerDexData {
  name: string;        // defaults to "Partner", renameable later
  dex: number[];       // sorted array of lucky dex numbers
  updatedAt: string;   // ISO timestamp
}
```

## Implementation Tasks

- [ ] Add optional `neededBy` to `PriorityPokemon` in `src/types/index.ts`
- [ ] Create `src/hooks/usePartnerDex.ts` — hook managing `PartnerDexData` in localStorage with validation (reject malformed, filter out-of-range, dedupe)
- [ ] Add `consumePendingDexImport()` to `src/hooks/useLuckyList.ts` — neutral method returning `{ dex, luckyCount, hash }`, refactor `applyPendingDexImport` to use it
- [ ] Extend `src/utils/priorityScorer.ts` — accept `partnerDex` in options, build union of user+partner missing, tag `neededBy`, sort within tier (both > you > partner)
- [ ] Propagate `neededBy` in `src/hooks/useCategorizedPokemon.ts`
- [ ] Add left border + badge to `src/components/PriorityCard.tsx`
- [ ] Pass `neededBy` through `src/components/PriorityList.tsx` + add "Showing trades for you + Partner" header
- [ ] Wire everything in `src/App.tsx` — two-step banner, overwrite confirmation, Tools dropdown "Clear Partner", progress bar partner info, toast + auto-navigate
- [ ] Add scorer regression tests in `tests/priorityScorer.test.ts` (no partner baseline, both/you/partner classification, no score distortion, sort within tier)
- [ ] Add validation tests in `tests/partnerDex.test.ts` (malformed payload, out-of-range filtering, dedupe, round-trip)

## Technical Details

### Scorer changes (`priorityScorer.ts`)
- Add `partnerDex?: Set<number> | null` to `ScoreOptions`
- `allMissing` = union of user-missing + partner-missing (user's canonicalized list provides names)
- When `partnerDex` is set: always emit explicit `"both" | "you" | "partner"` (never undefined)
- When `partnerDex` is null: `neededBy` left undefined, sort unchanged (identical to current)
- **No score bonus** — base scores stay untouched, sort within same score tier only

### `consumePendingDexImport()` (`useLuckyList.ts`)
Decoupled from partner logic. Decodes pending bitset, clears pending state, removes URL params. Returns `{ dex: Set<number>; luckyCount: number; hash: string } | null`. App.tsx decides routing.

## Data Flow
```
Wife texts share link → Sam opens it
  → useLuckyList detects ?dex= → pendingDexImport
  → Banner: "Whose list is this?" → "My partner's"
  → consumePendingDexImport() returns { dex, luckyCount, hash }
  → setPartnerDex() validates & stores { name: "Partner", dex, updatedAt }
  → auto-navigate to Trade Next tab
  → partnerDex changes → useMemo recomputes scorePokemon(..., { partnerDex })
  → scorer builds union, tags neededBy, sorts within tiers
  → PriorityCard renders left-border + badge
  → Toast: "Partner dex saved! 12 Pokemon you both need are available!"
```

## Edge Cases
- **No partner set**: null → scorer unchanged, no badges, no borders
- **Both open each other's links**: works — each saves the other as partner. No-own-list state disables partner option.
- **Identical lists**: available + both-missing entries get "both" + amber borders
- **Partner has everything**: no visual change, indicator still shows in progress bar
- **User clears own list**: partner dex persists independently
- **Stale partner data**: updatedAt shown in progress bar
- **Accidental overwrite**: confirmation dialog on >20% diff; extra guard when hasPartner
- **Malformed URL**: validation rejects, shows error

## Deferred to v2
- Paste-URL path in Tools dropdown (share link banner is sufficient for v1)
- Name prompt (default "Partner" for now, renameable later)
- Score bonus for "both need" (sort-within-tier is simpler and less confusing for v1)
