// asr-test.js — Bhashini ASR test (speech-to-text).
//
// Usage:
//   node asr-test.js <path-to-wav-file> <languageCode>
//
// Example:
//   node asr-test.js sample.wav hi

require('dotenv').config();
const fs = require('fs');

const UDYAT_KEY = process.env.UDYAT_KEY;
const INFERENCE_KEY = process.env.INFERENCE_KEY;

const CONFIG_ENDPOINT = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const COMPUTE_ENDPOINT = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const PIPELINE_ID = '64392f96daac500b55c543cd';

const AUDIO_PATH = process.argv[2];
const LANGUAGE = process.argv[3] || 'hi';

async function getServiceId() {
  const payload = {
    pipelineTasks: [
      { taskType: 'asr', config: { language: { sourceLanguage: LANGUAGE } } },
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

  const asrConfig = data.pipelineResponseConfig.find((t) => t.taskType === 'asr');
  if (!asrConfig) throw new Error(`No ASR service found for language "${LANGUAGE}" in this pipeline.`);
  return asrConfig.config[0].serviceId;
}

async function transcribe(serviceId, base64Audio) {
  const payload = {
    pipelineTasks: [
      {
        taskType: 'asr',
        config: {
          language: { sourceLanguage: LANGUAGE },
          serviceId,
          audioFormat: 'wav',
          samplingRate: 16000,
        },
      },
    ],
    inputData: {
      input: [{ source: '' }],
      audio: [{ audioContent: base64Audio }],
    },
  };

  const res = await fetch(COMPUTE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: INFERENCE_KEY },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Compute call failed (${res.status}): ${JSON.stringify(data)}`);

  return data.pipelineResponse[0].output[0].source;
}

async function main() {
  if (!AUDIO_PATH) {
    console.error('Usage: node asr-test.js <path-to-wav-file> <languageCode>');
    return;
  }
  if (!UDYAT_KEY || !INFERENCE_KEY) {
    console.error('Missing UDYAT_KEY and/or INFERENCE_KEY in .env');
    return;
  }
  if (!fs.existsSync(AUDIO_PATH)) {
    console.error(`File not found: ${AUDIO_PATH}`);
    return;
  }

  console.log(`Audio file: ${AUDIO_PATH}`);
  console.log(`Language: ${LANGUAGE}`);

  try {
    const base64Audio = fs.readFileSync(AUDIO_PATH).toString('base64');
    console.log(`Read ${base64Audio.length} base64 chars.`);

    const serviceId = await getServiceId();
    console.log('Using serviceId:', serviceId);

    const transcript = await transcribe(serviceId, base64Audio);
    console.log('\nTranscript:', transcript);
  } catch (err) {
    console.error('\nFailed:', err.message);
  }
}

main();