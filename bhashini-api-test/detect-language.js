
// detect-language.js — Bhashini Text Language Detection test.
// Checks: (1) which language the text is in, (2) whether it's written in
// the language's native script or romanized (English alphabet) — that's
// what the `scriptCode` field tells us (e.g. "Deva" vs "Latn").
//
// No Config call needed here — serviceId is fixed/documented.
//
// Usage:
//   node detect-language.js "text to check" [serviceId]
//
// Examples:
//   node detect-language.js "मुझे बारिश पसंद है"
//   node detect-language.js "mujhe baarish pasand hai"
//   node detect-language.js "Hello, how are you?" bhashini/iiiith/indic-lang-detection-all
 
require('dotenv').config();
 
const INFERENCE_KEY = process.env.INFERENCE_KEY;
const COMPUTE_ENDPOINT = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
 
const TEXT = process.argv[2] || 'mujhe baarish pasand hai';
const SERVICE_ID = process.argv[3] || 'bhashini/indic-lang-detection-all';
 
async function detectLanguage(text) {
  const payload = {
    pipelineTasks: [
      {
        taskType: 'txt-lang-detection',
        config: { serviceId: SERVICE_ID },
      },
    ],
    inputData: { input: [{ source: text }] },
  };
 
  const res = await fetch(COMPUTE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: INFERENCE_KEY },
    body: JSON.stringify(payload),
  });
 
  const data = await res.json();
  if (!res.ok) throw new Error(`Compute call failed (${res.status}): ${JSON.stringify(data)}`);
 
  return data.pipelineResponse[0].output[0].langPrediction;
}
 
async function main() {
  if (!INFERENCE_KEY) {
    console.error('Missing INFERENCE_KEY in .env');
    return;
  }
 
  console.log(`Text: "${TEXT}"`);
  console.log(`serviceId: ${SERVICE_ID}`);
  try {
    const predictions = await detectLanguage(TEXT);
    console.log('\nPredictions:');
    predictions.forEach((p, i) => {
      console.log(
        `  ${i + 1}. langCode: ${p.langCode}  scriptCode: ${p.scriptCode}  score: ${p.langScore}`
      );
    });
  } catch (err) {
    console.error('\nFailed:', err.message);
  }
}
 
main();
 
