import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import configService from '../src/services/bhashini/config.service.js';
import httpClient from '../src/utils/http-client.js';
import env from '../src/config/env.js';
import { BHASHINI_ENDPOINTS, BHASHINI_TASK_TYPES } from '../src/config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCALES_DIR = path.resolve(__dirname, '../Frontend/src/locales');

const EN_STRINGS = {
  app_title: 'WeatherGPT',
  ministry_title: 'GOVERNMENT OF INDIA · MINISTRY OF EARTH SCIENCES',
  app_tagline: 'Weather & disaster alerts, in your language',
  official_service: 'Official service of the Ministry of Earth Sciences',
  phone_tab: 'Phone number',
  email_tab: 'Email address',
  mobile_number: 'Mobile number',
  also_add_email: "Also add your email — we'll verify it too",
  also_add_phone: "Also add your phone — we'll verify it too",
  optional: 'optional',
  btn_continue: 'Continue',
  please_wait: 'Please wait…',
  btn_back: 'Back',
  enter_code_sent_to: 'Enter the 6-digit code sent to',
  didnt_receive_code: "Didn't receive code?",
  resend_code: 'Resend code',
  resend_in: 'Resend in',
  btn_verify_continue: 'Verify & continue',
  complete_your_profile: 'Complete your profile',
  welcome_complete_profile: 'Welcome to WeatherGPT! Personalize your alerts in a few quick steps.',
  your_name: 'Your name',
  what_best_describes_you: 'What best describes you?',
  select_role: 'Select your role',
  your_location: 'Your location',
  detect_my_location: 'Detect my location',
  preferred_language: 'Preferred language',
  btn_complete_setup: 'Complete setup & continue',
  saving: 'Saving…',
  verify_secondary_contact: 'Verify secondary contact',
  btn_verify_finish: 'Verify & finish',
  verifying: 'Verifying…',
  ill_do_this_later: "I'll do this later",
  greeting_namaste: 'Namaste',
  overview_advisory_for: "Today's weather overview & safety advisory for",
  btn_retry: 'Retry',
  next_few_hours: 'Next few hours',
  next_5_days: 'Next 5 days',
  today_updated_now: 'Today · updated just now',
  feels_like: 'Feels like',
  high: 'High',
  low: 'Low',
  rain: 'Rain',
  humidity: 'Humidity',
  wind: 'Wind',
  air_quality_index: 'Air quality index',
  out_of_500: 'out of 500',
  aqi_good: 'Good',
  aqi_moderate: 'Moderate',
  aqi_poor: 'Poor',
  aqi_severe: 'Severe',
  change_location: 'Change location',
  use_current_location: 'Use my current location',
  detecting: 'Detecting…',
  location_detected: 'Location detected ✓',
  or: 'OR',
  choose_city: 'Choose a city',
  enter_pin: 'Enter 6-digit PIN code',
  pin_placeholder: 'Enter PIN code (e.g. 110001)',
  btn_cancel: 'Cancel',
  btn_apply: 'Apply',
  applying: 'Applying…',
  your_profile: 'Your profile',
  phone_email: 'Phone / email',
  name: 'Name',
  role: 'Role',
  location: 'Location',
  btn_change: 'Change',
  language: 'Language',
  btn_save_changes: 'Save changes',
  btn_sign_out: 'Sign out',
  alert: 'Alert',
  chat_panel_title: 'WeatherGPT chat',
  chat_panel_subtitle: 'Ask anything about the weather',
  chat_input_placeholder: 'Type your question…',
  chat_welcome_message: "Namaste! Ask me about today's weather, alerts, or your forecast.",
  chat_chip_rain: 'Will it rain tomorrow?',
  chat_chip_safe: 'Is it safe to go outside today?',
  chat_chip_forecast: 'Show 5-day forecast',
  chat_waking_up_hint: 'Waking up the service, this can take up to a minute',
  chat_error_504: 'The weather assistant is waking up, please try again in a minute',
  chat_error_503: 'Our AI systems are busy, try again shortly',
  chat_error_400_location: 'Please pick your city from the location menu',
  weather_group_thunderstorm: 'Thunderstorm',
  weather_group_drizzle: 'Drizzle',
  weather_group_rain: 'Rain',
  weather_group_snow: 'Snow',
  weather_group_atmosphere: 'Mist & fog',
  weather_group_clear: 'Clear sky',
  weather_group_clouds: 'Cloudy',
  thunderstorm: 'Thunderstorm',
  drizzle: 'Drizzle',
  rain: 'Rain',
  snow: 'Snow',
  atmosphere: 'Mist & fog',
  clear: 'Clear sky',
  error_location_not_found: 'We couldn’t find weather for this place. Please choose a nearby city.',
  error_weather_unavailable: 'Live weather data is temporarily unavailable — showing the last known forecast for {{location}}.',
  error_location_mismatch: 'Couldn’t load weather for {{newLocation}}. Still showing {{previousLocation}}.',
  search_place_label: 'Search city, town or village',
  search_place_placeholder: 'Type at least 3 letters (e.g. Manali, Leh)',
  searching: 'Searching places…',
  no_places_found: 'No places found',
  popular_cities: 'Popular cities',
  chat_error_location_unrecognized: 'I couldn’t recognise {{city}}. Please choose a nearby larger city from the location menu.',
};

const TARGET_LANGUAGES = ['hi', 'bn', 'mr', 'ta', 'te', 'gu', 'kn', 'pa', 'or', 'ml', 'ur'];

async function translateBatch(texts, targetLanguage) {
  if (!texts.length) return [];
  try {
    const serviceId = await configService.getServiceId(BHASHINI_TASK_TYPES.TRANSLATION, {
      sourceLanguage: 'en',
      targetLanguage,
    });

    const payload = {
      pipelineTasks: [
        {
          taskType: BHASHINI_TASK_TYPES.TRANSLATION,
          config: {
            language: { sourceLanguage: 'en', targetLanguage },
            serviceId,
          },
        },
      ],
      inputData: {
        input: texts.map((t) => ({ source: t })),
      },
    };

    const response = await httpClient(BHASHINI_ENDPOINTS.COMPUTE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: env.BHASHINI_INFERENCE_KEY,
      },
      body: JSON.stringify(payload),
      timeoutMs: 25000,
      retries: 2,
    });

    if (!response.ok) {
      console.warn(`Translation request failed for ${targetLanguage} with HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    const outputs = data?.pipelineResponse?.[0]?.output || [];
    return outputs.map((o) => o.target);
  } catch (err) {
    console.error(`Error translating to ${targetLanguage}:`, err.message);
    return null;
  }
}

async function main() {
  if (!fs.existsSync(LOCALES_DIR)) {
    fs.mkdirSync(LOCALES_DIR, { recursive: true });
  }

  // 1. Write English locale
  fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify(EN_STRINGS, null, 2), 'utf-8');
  console.log('✓ Written en.json');

  const allKeys = Object.keys(EN_STRINGS);

  // 2. Translate for each language
  for (const lang of TARGET_LANGUAGES) {
    const filePath = path.join(LOCALES_DIR, `${lang}.json`);
    let existingMap = {};
    if (fs.existsSync(filePath)) {
      try {
        existingMap = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        existingMap = {};
      }
    }

    const missingKeys = allKeys.filter((k) => !existingMap[k]);
    if (missingKeys.length > 0) {
      console.log(`Translating ${missingKeys.length} new keys to ${lang}...`);
      const textsToTranslate = missingKeys.map((k) => EN_STRINGS[k]);
      const translated = await translateBatch(textsToTranslate, lang);

      missingKeys.forEach((key, idx) => {
        existingMap[key] = (translated && translated[idx]) ? translated[idx] : EN_STRINGS[key];
      });
    }

    // Ensure order matches allKeys
    const finalMap = {};
    allKeys.forEach((k) => {
      finalMap[k] = existingMap[k] || EN_STRINGS[k];
    });

    // Enforce untranslated WeatherGPT brand name
    finalMap.app_title = 'WeatherGPT';
    if (finalMap.chat_panel_title) {
      // Keep "WeatherGPT" in Latin letters followed by the chat word
      const chatWords = {
        hi: 'चैट',
        bn: 'চ্যাট',
        mr: 'संवाद',
        ta: 'அரட்டை',
        te: 'చాట్',
        gu: 'ચેટ',
        kn: 'ಚಾಟ್',
        pa: 'ਗੱਲਬਾਤ',
        or: 'ବାର୍ତ୍ତାଳାପ',
        ml: 'ചാറ്റ്',
        ur: 'چیٹ',
      };
      finalMap.chat_panel_title = `WeatherGPT ${chatWords[lang] || 'chat'}`;
    }
    if (finalMap.welcome_complete_profile) {
      finalMap.welcome_complete_profile = finalMap.welcome_complete_profile
        .replace(/मौसम जी\.?\s*पी\.?\s*टी\.?/gi, 'WeatherGPT')
        .replace(/वेदर जी\.?\s*पी\.?\s*टी\.?/gi, 'WeatherGPT')
        .replace(/वेदरजीपीटी/gi, 'WeatherGPT')
        .replace(/हवामान जी\.?\s*पी\.?\s*टी\.?/gi, 'WeatherGPT')
        .replace(/ওয়েদারজিপিটি/gi, 'WeatherGPT')
        .replace(/હવામાન જીપીટી/gi, 'WeatherGPT')
        .replace(/ಹವಾಮಾನ ಜಿ\.?\s*ಪಿ\.?\s*ಟಿ\.?/gi, 'WeatherGPT')
        .replace(/ವೆದರ್ ಜಿ\.?\s*ಪಿ\.?\s*ಟಿ\.?/gi, 'WeatherGPT')
        .replace(/കാലാവസ്ഥാ ജിപിടി/gi, 'WeatherGPT')
        .replace(/വെതർ ജി\.?\s*പി\.?\s*ടി/gi, 'WeatherGPT')
        .replace(/ପାଣିପାଗ ଜି\.?\s*ପି\.?\s*ଟି/gi, 'WeatherGPT')
        .replace(/ୱେଦର ଜି\.?\s*ପି\.?\s*ଟି\.?/gi, 'WeatherGPT')
        .replace(/ਮੌਸਮ ਜੀ\.?\s*ਪੀ\.?\s*ਟੀ/gi, 'WeatherGPT')
        .replace(/ਵੈਦਰ ਜੀ\.?\s*ਪੀ\.?\s*ਟੀ\.?/gi, 'WeatherGPT')
        .replace(/வானிலை ஜி\.?\s*பி\.?\s*டி/gi, 'WeatherGPT')
        .replace(/వాతావరణ జిపిటి/gi, 'WeatherGPT')
        .replace(/వెదర్ జీపీటీ/gi, 'WeatherGPT')
        .replace(/ویدر جی پی ٹی/gi, 'WeatherGPT');
    }

    fs.writeFileSync(filePath, JSON.stringify(finalMap, null, 2), 'utf-8');
    console.log(`✓ Written ${lang}.json (${Object.keys(finalMap).length} strings)`);
  }

  console.log('\nAll 12 locale files successfully updated!');
}

main().catch(console.error);
