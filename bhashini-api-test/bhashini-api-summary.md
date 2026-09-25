# Bhashini API Testing Summary — WeatherGPT (SIH 2026)

Reference doc from isolated API testing (`bhashini-api-test` folder), before starting the actual WeatherGPT build.

## Setup

- Stack: Node.js (v24.16.0), native `fetch`, `dotenv`
- Platform: Bhashini Udyat dashboard — exposes only **UDYAT KEY** + **INFERENCE KEY** (no separate userID like the old ULCA docs describe)
- Pipeline ID used throughout: `64392f96daac500b55c543cd` (MeitY) — the only working one; the alternate `643930aa521a4b1ba0f4c41d` (AI4Bharat) is not registered under this account

## Auth (discovered by testing, not documented anywhere)

| Call | Endpoint | Header |
|---|---|---|
| Config | `https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline` | `ulcaApiKey: <UDYAT_KEY>` |
| Compute | `https://dhruva-api.bhashini.gov.in/services/inference/pipeline` | `Authorization: <INFERENCE_KEY>` |

Every task below follows the same two-step flow: **Config call** (get the right `serviceId` for the language) → **Compute call** (do the actual work).

## API-by-API status

| API | Does what | Status | Gotchas |
|---|---|---|---|
| **NMT** (Translation) | Text → text, one language to another | Working both directions | None |
| **ASR** (Speech-to-Text) | Audio → text | Working | `inputData.input[0].source` must be `""`, not `null` (server returns 422 on `null`) |
| **TTS** (Text-to-Speech) | Text → audio | Working | Some native-script languages (e.g. Bengali) need `sourceScriptCode` (e.g. `"Beng"`) set explicitly, or the audio comes back silent. Romanized text doesn't need this. |
| **TLD** (Text Language Detection) | Guesses what language a piece of text is in | Native script works / Romanized does not | Tested all 3 registered serviceIds — none of them can identify a romanized (English-letter) Indic language. Any Latin-script text just gets labeled `en`. This is a Bhashini limitation, not a bug in our code. |
| **Transliteration** | Converts romanized text into native script (e.g. "namaste" -> "नमस्ते") | Working | Doubles as a practical workaround for the TLD romanized-text gap (see below) |

## Language coverage

- Reliable: the 22 scheduled Indian languages + English
- Not supported (confirmed by testing): Bhojpuri — fails on both available pipeline IDs, for both ASR and NMT. Likely applies to other non-scheduled languages too (Awadhi, Braj, Magahi, etc.)

## Does Bhashini auto-detect language on its own?

No — not automatically. TLD is a separate, manual API call. NMT/ASR/TTS all require you to tell them the `sourceLanguage` yourself; they don't detect it for you internally. If you want auto-detection in WeatherGPT, the flow has to be built explicitly:

1. Call TLD on the user's text first
2. If it returns a confident native-script result -> use that `langCode` for NMT/ASR/TTS
3. If it returns `en`/`Latn` on text you suspect is actually romanized Hindi (or another Indic language) -> TLD can't help here; either assume a default language, or run it through Transliteration first and work from there

So detection is possible, but it's a step you orchestrate yourself, not something baked into the other APIs.

## Test scripts (in `bhashini-api-test/`)

- `translate.js` — NMT, both directions, optional pipeline ID override
- `asr-test.js` — speech-to-text from a local WAV file
- `tts-test.js` — text-to-speech, saves output as WAV
- `detect-language.js` — TLD, serviceId swappable via CLI arg
- `transliterate-test.js` — romanized -> native script
