// test.js — Bhashini Pipeline Config API test (Translation task only)
// Purpose: confirm auth + reach the ULCA Pipeline Config endpoint before
// touching NMT/ASR/TTS/TLD/Transliteration compute calls.
//
// Run:  node test.js
// Needs: UDYAT_KEY set in .env, and `npm install dotenv` done first.

require('dotenv').config();

const UDYAT_KEY = process.env.UDYAT_KEY;

// Documented (ULCA-era) endpoint for the Pipeline Config call.
// This part of the flow has not changed with the Udyat rebrand as far as
// published docs show.
const CONFIG_ENDPOINT = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';

// Widely-used default Bhashini pipeline ID (supports ASR+NMT+TTS).
// This is the same pipeline ID referenced across community examples and
// AI4Bharat sample code, not something invented for this test.
const PIPELINE_ID = '64392f96daac500b55c543cd';

const payload = {
  pipelineTasks: [
    {
      taskType: 'translation',
      config: {
        language: { sourceLanguage: 'en', targetLanguage: 'hi' },
      },
    },
  ],
  pipelineRequestConfig: { pipelineId: PIPELINE_ID },
};

async function attempt(label, headers) {
  console.log(`\n--- Attempt: ${label} ---`);
  try {
    const res = await fetch(CONFIG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
    if (res.ok) {
      console.log(`\n✅ "${label}" worked. Use this header pattern for the rest of the tests.`);
      return true;
    }
  } catch (err) {
    console.error('Request failed:', err.message);
  }
  return false;
}

async function main() {
  if (!UDYAT_KEY) {
    console.error('Missing UDYAT_KEY in .env — add it (UDYAT_KEY=your_key_here) and re-run.');
    return;
  }

  // The official docs still only describe a userID + ulcaApiKey pair for
  // this call. Your Udyat dashboard doesn't expose a userID, so this is
  // genuinely untested ground — we try a few plausible mappings and let
  // Bhashini's own error message (usually specific) tell us which is right.
  const attempts = [
    ['userID + ulcaApiKey, both set to Udyat Key', { userID: UDYAT_KEY, ulcaApiKey: UDYAT_KEY }],
    ['ulcaApiKey header, no userID', { ulcaApiKey: UDYAT_KEY }],
    ['Authorization header (raw key)', { Authorization: UDYAT_KEY }],
    ['udyatKey header', { udyatKey: UDYAT_KEY }],
  ];

  for (const [label, headers] of attempts) {
    const ok = await attempt(label, headers);
    if (ok) return;
  }

  console.log(
    "\nNone of these worked. Copy the Status + Body from each attempt above — " +
      "Bhashini's error text usually names the exact missing/invalid header or field, " +
      'which tells us precisely what to change next.'
  );
}

main();