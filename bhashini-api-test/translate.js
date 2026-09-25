// translate.js — Bhashini NMT test (Config + Compute), now using the
// confirmed-working auth patterns:
//   Config call  -> header: ulcaApiKey
//   Compute call -> header: Authorization (raw Inference key)
//
// Usage:
//   node translate.js "text to translate" <sourceLang> <targetLang> [pipelineId]
//
// Examples:
//   node translate.js "Hello, how are you?" en hi
//   node translate.js "Hello, how are you?" en bho 643930aa521a4b1ba0f4c41d

require('dotenv').config();

const UDYAT_KEY = process.env.UDYAT_KEY;
const INFERENCE_KEY = process.env.INFERENCE_KEY;

const CONFIG_ENDPOINT = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const COMPUTE_ENDPOINT = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

const TEXT = process.argv[2] || 'Hello, how are you?';
const SOURCE_LANG = process.argv[3] || 'en';
const TARGET_LANG = process.argv[4] || 'hi';
const PIPELINE_ID = process.argv[5] || '64392f96daac500b55c543cd';

async function getServiceId() {
  const payload = {
    pipelineTasks: [
      {
        taskType: 'translation',
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

  const translationConfig = data.pipelineResponseConfig.find((t) => t.taskType === 'translation');
  return translationConfig.config[0].serviceId;
}

async function translate(serviceId) {
  const payload = {
    pipelineTasks: [
      {
        taskType: 'translation',
        config: {
          language: { sourceLanguage: SOURCE_LANG, targetLanguage: TARGET_LANG },
          serviceId,
        },
      },
    ],
    inputData: {
      input: [{ source: TEXT }],
      audio: [{ audioContent: null }],
    },
  };

  const res = await fetch(COMPUTE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: INFERENCE_KEY },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Compute call failed (${res.status}): ${JSON.stringify(data)}`);

  return data.pipelineResponse[0].output[0].target;
}

async function main() {
  if (!UDYAT_KEY || !INFERENCE_KEY) {
    console.error('Missing UDYAT_KEY and/or INFERENCE_KEY in .env');
    return;
  }

  console.log(`Translating (${SOURCE_LANG} -> ${TARGET_LANG}): "${TEXT}"`);
  try {
    const serviceId = await getServiceId();
    const translated = await translate(serviceId);
    console.log('\nResult:', translated);
  } catch (err) {
    console.error('\nFailed:', err.message);
  }
}

main();
