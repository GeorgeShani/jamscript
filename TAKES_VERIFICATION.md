# Takes rail presentation verification

## Implemented boundaries

- Three immutable synthetic examples remain in chronological order: 19:42 drums added, 19:43 hats 4 to 8, 19:44 bass lpf 1200 to 430. They do not describe the playing document or real history.
- Current is fixed by fixture ID, independently of selection. The current 19:44 chip retains its thin amber border and `aria-current`; selection uses a neutral selection surface and `aria-pressed`.
- Chips use shared Buttons with time and musical summary in their accessible names. Track dots, sans summaries and mono times are preserved. Context actions are sibling controls, never nested buttons.
- Compare opens the existing shared review via the single route-owned active review. It identifies selected and current examples, uses literal fixture rows and labels them Example diff. Comparing the current example with itself has no rows. Closing or Escape preserves selection and returns focus to Compare.
- Audition and Restore are visible but disabled after selection. Both reference the persistent nearby sentence: “Audition and restore will be available when Takes are connected.” The former fake restoration toast was removed.
- Desktop rail remains 56px. Narrow layouts add an action row and wrap the explanation without widening the document. Only deliberate selection of a clipped chip adjusts local scrolling; unrelated renders do not force scrolling.

## Automated and browser evidence

- 28 tests passed across Takes, existing editor previews, shared reviews and routing. Takes tests cover independent current/selection, source immutability, disabled actions, literal comparison payloads, stable rerenders and fixture-only states.
- Chromium checked 1280×720, 1920×1080, 768×1024, 390×844, 811×679 and 390×420. Document width equals viewport width at every size; selected actions fit. Desktop rail height is 56px. At 390px the chip list has 320px visible width and 535px content, scrolling locally by 215px without widening the document.
- Compare focuses the heading; Close comparison returns focus to Compare with selection intact. Escape also closes and restores focus. Selected 19:43 and current 19:44 remain distinct. Review body and code changes scroll inside the editor frame at short heights.
- Source text remains byte-for-byte unchanged after selection/comparison. Existing Play becomes Stop, then returns to Play, with three unchanged examples and unchanged code. No runtime errors observed. Audible output is not assessed by headless Chromium.
- Approved tokens, two fonts, existing shared Button states and focus rules remain in use; no cyan, new palette, shadows, gradients, packages, build configuration or engine changes.

## Fixture states requiring later engine wiring

`TAKE_FIXTURES` supplies explicit examples, empty, loading, unavailable and auditioning props. Normal use only mounts examples; no timer or Play callback changes fixture state.

- Empty: “No takes yet. Your first successful play will appear here.” This is intended connected-state copy only; no capture callback exists.
- Loading / unavailable: explicit presentations only, with no simulated loading completion or fake history.
- Auditioning: “Auditioning 19:43”, with Restore and Back to live, marked Example state only. Both remain disabled; no enabled control enters this state.
- Capture, semantic labels, persistence, computed comparison, audition audio, return-to-live audio, restoration and undo remain unimplemented. Real capabilities must supply validated data and real callbacks before enabling these actions.
- Physical-device safe areas, virtual keyboards and audible sound remain unverified.