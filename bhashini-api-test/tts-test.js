// tts-test.js — Bhashini TTS test (text-to-speech).
//
// Usage:
//   node tts-test.js "text to speak" <languageCode> [outputFile] [scriptCode]
//
// Examples:
//   node tts-test.js "Namaste, aaj mausam kaisa hai?" hi
//   node tts-test.js "আপনি কি রেগে আছেন?" bn tts-output.wav Beng
 
require('dotenv').config();
const fs = require('fs');
 
const UDYAT_KEY = process.env.UDYAT_KEY;
const INFERENCE_KEY = process.env.INFERENCE_KEY;
 
const CONFIG_ENDPOINT = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline';
const COMPUTE_ENDPOINT = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const PIPELINE_ID = '64392f96daac500b55c543cd';
 
const TEXT = process.argv[2];
const LANGUAGE = process.argv[3] || 'hi';
const OUTPUT_FILE = process.argv[4] || 'tts-output.wav';
const SCRIPT_CODE = process.argv[5] || '';
 
async function getServiceId() {
  const payload = {
    pipelineTasks: [
      { taskType: 'tts', config: { language: { sourceLanguage: LANGUAGE } } },
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
 
  const ttsConfig = data.pipelineResponseConfig.find((t) => t.taskType === 'tts');
  if (!ttsConfig) throw new Error(`No TTS service found for language "${LANGUAGE}" in this pipeline.`);
  return ttsConfig.config[0].serviceId;
}
 
async function synthesize(serviceId) {
  const language = { sourceLanguage: LANGUAGE };
  if (SCRIPT_CODE) language.sourceScriptCode = SCRIPT_CODE;
 
  const payload = {
    pipelineTasks: [
      {
        taskType: 'tts',
        config: {
          language,
          serviceId,
          gender: 'female',
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
 
  return data.pipelineResponse[0].audio[0].audioContent;
}
 
async function main() {
  if (!TEXT) {
    console.error('Usage: node tts-test.js "text to speak" <languageCode> [outputFile]');
    return;
  }
  if (!UDYAT_KEY || !INFERENCE_KEY) {
    console.error('Missing UDYAT_KEY and/or INFERENCE_KEY in .env');
    return;
  }
 
  console.log(`Text: "${TEXT}"`);
  console.log(`Language: ${LANGUAGE}`);
 
  try {
    const serviceId = await getServiceId();
    console.log('Using serviceId:', serviceId);
 
    const base64Audio = await synthesize(serviceId);
    const buffer = Buffer.from(base64Audio, 'base64');
    fs.writeFileSync(OUTPUT_FILE, buffer);
    console.log(`\nSaved audio to ${OUTPUT_FILE} (${buffer.length} bytes) — play it to confirm.`);
  } catch (err) {
    console.error('\nFailed:', err.message);
  }
}
 
main();
 