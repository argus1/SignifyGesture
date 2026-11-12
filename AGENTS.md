<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Signify state and the repair agent live in one client context (src/lib/signify-store.tsx) that also exposes window.NativeASLBridge; why: the simulator and a future native app must drive the same code path.
- Native bridge contract lives in src/types/nativeBridge.ts (inbound payload shapes from the project spec, plus two extensions: optional `alternatives` on onSignDetected for the repair agent, and `onSpeechTranscribed({text,isFinal})` for the hearing person's mic speech, which becomes the left-side captions). Outbound commands are in src/lib/nativeBridge.ts and post to `window.webkit.messageHandlers.aslBridge`; AWS sync is stubbed in src/services/awsSync.ts. Never use browser camera, ML, speechSynthesis, or 3D libraries — native Swift owns those.
- Camera areas use `CameraViewport` (transparent, `.native-viewport`); when running inside the iOS wrapper, `html[data-native-host]` makes camera screens see-through so the native layer shows underneath.
- Keep the phone frame viewport-height constrained, pin the shared TabBar using global height/bottom tokens, and scroll content inside screens; why: long pages must never move navigation below the phone or hide final actions.
- Share sheets opt into a raised phone-frame stacking layer while open; why: the external Bridge Simulator must not intercept their action buttons.
