# Accessibility QA — HIG and communication accessibility (#12)

**Tester:** Venus Li · **Dates:** 2026-11-10 and 2026-11-11 · **Builds:** `dev` @ `aa76c33`; re-tested on `dev` @ `5021a3d` + #26
**Devices:** iPhone 14 Plus  via native shell; web frontend in desktop browser
**References:** [Apple HIG — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility),
repository [`Standards/`](../Standards/) (ADA effective communication, TRS WG report), and the sprint plan's
regulatory and accessibility checkpoints.

> This is a prototype QA pass, not a compliance audit. Untested items are listed as **Not tested**, not assumed to pass.

**Status key:** ✅ Pass · ❌ Fail · ⚠️ Likely issue from code review, needs on-screen confirmation · ⬜ Not tested

## Prioritized findings

| # | Severity | Screen | Finding | Suggested fix | Owner |
|---|---|---|---|---|---|
| F1 | **Critical** ⚠️ | All / onboarding | No "experimental, five isolated signs, not an interpreter" disclosure found in the UI (required by #1, #13). | Add the #1 limitation statement to onboarding and the translate screen. | TBD |
| F2 | **Major** ❌ | Conversation → Home → back | Camera button reads "Stop camera" while the camera is already stopped. Visible label and VoiceOver label misstate the state. | Derive the label from native `cameraActive` state, not the last button press. | TBD |
| F3 | **Major** ⚠️ | Bridge Simulator / demo | Demo content uses HELLO/LATTE and a coffee-order scenario instead of the five agreed glosses. Implies capability outside scope. | Swap sample content to RESEARCH, DEVELOP, CLOUD, EDIT, DECIDE. | TBD |
| F4 | **Major** ⚠️ | recap, agent, sign, home | Several controls are 24–32px, below the HIG 44×44pt minimum hit target. | Raise hit areas to ≥44pt (padding is fine; visual size can stay). | TBD |
| F5 | Minor ❌ | Sign / camera | Hand-skeleton overlay is smaller than the hand in the camera feed, which weakens tracking feedback. | Scale overlay to match the preview layer. | TBD |
| F6 | Minor ❌ | Sign / camera | Status text "no compatible sign recognition Core ML model is bundled" is developer language. | "Hand tracking is on. Sign recognition isn't available in this demo yet." | TBD |
| F7 | Minor ⚠️ | sign, messages detail, ui | 10–11px text in 6 places. | Use ≥ body/caption text styles that scale with Dynamic Type. | TBD |
| F8 | ~~Major~~ ✅ Fixed | Conversation → speech mode | Was: "Listening" with no captions (no native STT). Re-tested 2026-11-11: live captions work on device after Gus's speech transcription build. | — | Gus |
| F9 | ~~Critical~~ ✅ Fixed | Signing → Start camera (fresh install) | Camera rationale alert never appeared, so iOS never asked for camera access and tapping Start camera did nothing. Cause: camera and microphone `.alert(item:)` modifiers chained on the same view. | Fixed in #26 (microphone alert moved to a child view); shipped in TestFlight 0.2.0. | Venus |
| F10 | Minor ❌ | Conversation (bottom bar) | The floating "Bridge Simulator" dev button covers the third tab (Speech) in the native app; judges would see a developer tool. | Hide the Bridge Simulator in the native host / demo build. | TBD |

## A. Apple HIG accessibility checklist

### Vision
| Check | Status | Notes |
|---|---|---|
| VoiceOver: every control has a meaningful label | ✅ | Help panel verified on device ("Help, button", labeled search field). Main screens: most controls have visible text or `aria-label`. |
| VoiceOver: logical focus/reading order | ✅ | Help panel reading order logical; focus returns to Help button on close. |
| VoiceOver: status changes announced (tracking, result, errors) | ⚠️ | `aria-live`/`role="status"` present on sign and captions screens; confirm on device. |
| Dynamic Type / Larger Text: text scales without truncation or overlap | ⬜ | See F7. |
| Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI icons | ⬜ | |
| Color is never the only indicator of state | ✅ | "Camera off" and "Listening" shown as text on the Signing/Speech screens. |
| Safe areas: nothing under notch, Dynamic Island, or home indicator | ⬜ | Camera UI was built for iPad first. |

### Hearing
| Check | Status | Notes |
|---|---|---|
| All spoken output also available as text | ⬜ | |
| Hearing person's speech shown as captions | ✅ | Live captions work on iPhone 14 Plus (F8 fixed). |
| No information conveyed by sound alone | ⬜ | |

### Mobility
| Check | Status | Notes |
|---|---|---|
| Hit targets ≥ 44×44pt | ⚠️ | See F4. |
| Stop / cancel always reachable | ✅ | Camera stop works on device. |
| No gestures required without a simple alternative | ⬜ | |

### Cognitive and motion
| Check | Status | Notes |
|---|---|---|
| Reduce Motion respected | ⚠️ | `prefers-reduced-motion` handled for most animations in code; confirm on device. |
| Plain-language status and errors | ❌ | See F6. |
| Predictable navigation and state after back / return | ❌ | See F2. |

## B. Communication-accessibility checklist

Based on the repository `Standards/` documents and the sprint plan checkpoints.

| Check | Status | Notes |
|---|---|---|
| Clear text output the user can read before any speech | ⬜ | |
| User can edit / correct recognized text before speaking | ⬜ | Covered by #11. |
| Speech is opt-in and can be stopped immediately | ⬜ | |
| Uncertainty / no-result shown honestly, never as a confident translation | ✅ | Device shows "tracking only, recognition unavailable". Wording: F6. Help text reviewed in #18. |
| Usable without camera (text-only path) | ⬜ | |
| Usable without audio | ⬜ | |
| Camera use explained before the iOS permission prompt | ✅ | Rationale alert appears before the iOS prompt (after F9 fix). |
| Permission denial / revocation has a clear recovery path | ✅ | Changes in iOS Settings reflected in app. |
| Limitations disclosed; not presented as interpreter, TRS, or emergency/medical tool | ⚠️ | See F1. |
| Multiple access needs considered; Deaf/HoH feedback gathered | ⬜ | No Deaf/HoH reviewer yet. |

## C. Native device checklist (from `NATIVE_IOS_XCODE_DEVICE_GUIDE.md`)

| Check | Status |
|---|---|
| Web interface loads in the native shell | ✅ |
| Camera preview starts and stops from the control | ✅ |
| Capture stops when leaving / backgrounding the app and restarts on return | ✅ |
| Camera permission changes in iOS Settings are reflected in the app | ✅ |

## D. Speech paths: captions (speech-to-text) and transcript TTS

Tested as separate paths, per the #12 checklist.

| Check | Status | Notes |
|---|---|---|
| Microphone permission prompt is explained; denial has a recovery path | ✅ | Rationale alert shown before the iOS prompt; denial offers Open Settings / Type instead. |
| Partial captions appear while the hearing person speaks, then finalize | ✅ | Works on iPhone 14 Plus. |
| Caption error state is shown as text | ⬜ | Not re-tested after F8 fix. |
| TTS speaks only after an explicit user action (speak / replay) | ⬜ | |
| TTS can be stopped immediately; transcript stays visible | ⬜ | |
| App does not caption its own TTS output | ⬜ | Blocked until native STT exists. |

## Not tested / unvalidated

- Dynamic Type at the largest sizes and contrast measurements on device
- VoiceOver on the main conversation screens beyond the help panel
- Scrolling inside the open help panel with VoiceOver (three-finger scroll) — follow-up noted on #18
- Landscape orientation and iPad layouts
- No Deaf/HoH participants have reviewed the app; all communication-accessibility findings are from the team's perspective only
- Sign recognition itself (no model bundled), so recognition accuracy and confidence UI were not evaluated on real predictions
