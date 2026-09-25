// transliterate-test.js — Bhashini Transliteration test.
// Converts romanized text into native script (e.g. "namaste" -> "नमस्ते").
// Note: sourceLanguage = "en" (the romanized input), targetLanguage = the
// actual Indic language whose script you want the output in.
//
// Usage:
//   node transliterate-test.js "romanized text" <targetLangCode>
//
// Examples:
//   node transliterate-test.js "namaste" hi
//   node transliterate-test.js "aapni kemon achen" bn

require('dotenv').config();

const UDYAT_KEY = process.env.UDYAT_KEY;
const INFERENCE_KEY = process.env.INFERENCE_KEY;

const CONFIG_ENDPOINT = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const COMPUTE_ENDPOINT = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const PIPELINE_ID = '64392f96daac500b55c543cd';

const TEXT = process.argv[2];
const SOURCE_LANG = 'en';
const TARGET_LANG = process.argv[3] || 'hi';

async function getServiceId() {
  const payload = {
    pipelineTasks: [
      {
        taskType: 'transliteration',
        config: { language: { sourceLanguage: SOURCE_LANG, targetLanguage: TARGET_LANG } },
      },
    ],
    pipelineRequestConfig: { pipelineId: PIPELINE_ID },
  };

  const res = await fetch(CONFIG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ulcaApiKey: UDYAT_KEY },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Config call failed (${res.status}): ${JSON.stringify(data)}`);

  const config = data.pipelineResponseConfig.find((t) => t.taskType === 'transliteration');
  if (!config) throw new Error(`No transliteration service found for target "${TARGET_LANG}".`);
  return config.config[0].serviceId;
}

async function transliterate(serviceId) {
  const payload = {
    pipelineTasks: [
      {
        taskType: 'transliteration',
        config: {
          language: { sourceLanguage: SOURCE_LANG, targetLanguage: TARGET_LANG },
          serviceId,
          isSentence: true,
          numSuggestions: 3,
        },
      },
    ],
    inputData: { input: [{ source: TEXT }] },
  };

  const res = await fetch(COMPUTE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: INFERENCE_KEY },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Compute call failed (${res.status}): ${JSON.stringify(data)}`);

  return data.pipelineResponse[0].output[0];
}

async function main() {
  if (!TEXT) {
    console.error('Usage: node transliterate-test.js "romanized text" <targetLangCode>');
    return;
  }
  if (!UDYAT_KEY || !INFERENCE_KEY) {
    console.error('Missing UDYAT_KEY and/or INFERENCE_KEY in .env');
    return;
  }

  console.log(`Text: "${TEXT}"`);
  console.log(`Target language: ${TARGET_LANG}`);

  try {
    const serviceId = await getServiceId();
    console.log('Using serviceId:', serviceId);

    const result = await transliterate(serviceId);
    console.log('\nResult:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('\nFailed:', err.message);
  }
}

main();
