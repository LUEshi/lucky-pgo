# Partner Dex Overlay Validation

## Scope Reviewed
- `docs/partner-dex-overlay.md`
- `src/hooks/useLuckyList.ts`
- `src/utils/priorityScorer.ts`
- `src/App.tsx`
- `src/components/PriorityCard.tsx`
- `src/components/PriorityList.tsx`
- `src/types/index.ts`
- `src/hooks/useCategorizedPokemon.ts`

## What Already Aligns
- Current link import flow already detects `?dex=...` + checksum and presents a pending import banner (`useLuckyList` + `App`).
- Current architecture already centralizes score creation in `priorityScorer.ts`, and rendering separation (`PriorityList` -> `PriorityCard`) is suitable for `neededBy` propagation.
- `useLuckyList` already canonicalizes to full dex (1..1025), so partner-union naming assumptions are feasible.

## Gaps Between Spec And Current Code

### 1. No partner storage hook exists
- Spec requires `usePartnerDex` with validation and metadata.
- Current code has no partner localStorage key/data model.
- Impact: required new hook + storage schema + migration-safe parsing.

### 2. `PriorityPokemon` has no `neededBy`
- `src/types/index.ts` currently defines only `name`, `normalizedName`, `score`, `sources`.
- Impact: scorer/components cannot represent "both / you / partner" state yet.

### 3. Scorer only considers current user's missing dex
- `src/utils/priorityScorer.ts` currently derives `missing` from one list and has no partner option.
- Sorting is only `score desc`, no within-tier tiebreaker for `neededBy`.
- Impact: must add `partnerDex` option, union missing set, explicit tagging rules.

### 4. Categorization/render chain drops partner context
- `src/hooks/useCategorizedPokemon.ts` does not carry `neededBy`.
- `src/components/PriorityCard.tsx` has no border/badge logic for partner states.
- `src/components/PriorityList.tsx` has no partner-aware header.
- Impact: UI cannot surface overlay state until all three layers are updated.

### 5. Pending share-link flow is not neutral
- `src/hooks/useLuckyList.ts` has `applyPendingDexImport` (imports as own list) and `dismissPendingDexImport`.
- Spec needs `consumePendingDexImport(): { dex, luckyCount, hash } | null` so `App` can route to "Mine" vs "Partner".
- Impact: new neutral consume API plus refactor existing import path to reuse it.

### 6. App banner behavior differs substantially
- Current banner is two actions: "Import Shared Dex" / "Keep My Dex".
- Spec requires first-step choice "Mine" vs "My partner's"/"Update partner", plus disabled partner path when user has no own list.
- Impact: UI state machine and button copy changes needed in `App.tsx`.

### 7. Overwrite protection does not exist yet
- Current "Import Shared Dex" replaces without diff confirmation.
- Spec requires symmetric-difference threshold confirmation and extra guard when partner exists.
- Impact: add compare helper + confirmation branch before import.

### 8. Progress area currently supports only one user
- `src/components/ProgressBar.tsx` only renders one count.
- Spec requires merged partner indicator line.
- Impact: either extend `ProgressBar` props or render partner status near progress block in `App.tsx`.

### 9. Test harness coverage gap for planned tests
- `tests/` has csv/luckyShare/tradeRules only.
- `tsconfig.tests.json` currently includes selected src files (`csvParser`, `luckyShare`, `types`) and may need updates if new tests import scorer/hook modules.
- Impact: ensure test config includes new tested modules, then add scorer + partner tests.

## Assumptions To Confirm During Implementation
- Use `window.confirm` for overwrite protection (no modal infra exists).
- "Material diff" for has-partner confirmation can reuse the same symmetric-difference metric.
- Partner name defaults to `"Partner"` for v1; no rename UI in this pass.
- Partner option disabled when no own list means `luckyList === null`.

## Recommended Implementation Order
1. Types + new `usePartnerDex`.
2. Add neutral `consumePendingDexImport` in `useLuckyList`.
3. Update scorer + categorize + card/list rendering.
4. Wire `App.tsx` (banner routing, confirmations, toast, tab switch, tools, progress line).
5. Add tests and update test tsconfig include list if required.
