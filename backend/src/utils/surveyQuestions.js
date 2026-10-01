// The community survey's questions, as language-neutral codes only. The
// website owns the wording (English, Spanish, and any language added later)
// and must use these exact ids and option codes - keep the two in sync
// (feed-sioux-falls-website/src/survey/questions.js).
//
// Every question is optional. Single/multi questions also accept
// PREFER_NOT, which the website shows on every choice question.
//
// Deliberately NOT asked: immigration status and criminal history. Those
// questions scare people away from the whole survey.

const PREFER_NOT = 'prefer_not';

// Language codes the website's survey picker offers
// (feed-sioux-falls-website/src/survey/languages.js). Some are placeholders
// until a translation is done, but are accepted here so finishing a
// translation only takes a website change.
const SURVEY_LANGUAGES = ['en', 'es', 'ne', 'sw', 'ar', 'dak', 'lkt'];

const SURVEY_QUESTIONS = [
  // Lets us count people over time without names.
  { id: 'repeat', type: 'single', options: ['first_time', 'yes_changed', 'yes_same'] },

  { id: 'slept_last_night', type: 'single', options: ['shelter', 'outside', 'vehicle', 'couch', 'motel', 'own_place', 'hospital_jail_treatment', 'other'] },
  // Parts of town, never addresses.
  { id: 'area', type: 'single', options: ['downtown', 'northwest', 'northeast', 'southwest', 'southeast', 'outside_city', 'not_sure'] },

  { id: 'housing_length', type: 'single', options: ['housed', 'under_1_month', '1_6_months', '6_12_months', '1_3_years', 'over_3_years'] },
  { id: 'first_time_homeless', type: 'single', options: ['yes', 'no'] },
  { id: 'time_in_sf', type: 'single', options: ['under_1_month', '1_12_months', '1_5_years', 'over_5_years', 'whole_life'] },
  { id: 'causes', type: 'multi', options: ['job_loss', 'rent_increase', 'eviction', 'domestic_violence', 'health', 'family', 'left_jail', 'left_foster_care', 'other'] },

  { id: 'age', type: 'single', options: ['under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus'] },
  { id: 'gender', type: 'multi', options: ['woman', 'man', 'nonbinary', 'transgender', 'two_spirit', 'other'] },
  { id: 'race', type: 'multi', options: ['american_indian', 'asian', 'black', 'hispanic', 'middle_eastern', 'pacific_islander', 'white', 'other'] },
  { id: 'with_you', type: 'multi', options: ['alone', 'partner', 'kids', 'other_family', 'friends', 'pets'] },
  { id: 'kids_count', type: 'single', options: ['1', '2', '3', '4', '5_plus'] },

  { id: 'applies', type: 'multi', options: ['veteran', 'dv_survivor', 'disability', 'physical_health', 'mental_health', 'substance_use', 'pregnant', 'lgbtq', 'foster_youth', 'recently_released'] },

  { id: 'work', type: 'multi', options: ['full_time', 'part_time', 'day_labor', 'looking', 'unable', 'not_looking'] },
  { id: 'income', type: 'multi', options: ['job', 'ssi_ssdi', 'va', 'snap', 'tanf', 'unemployment', 'family_help', 'odd_jobs', 'none', 'other'] },
  { id: 'photo_id', type: 'single', options: ['yes', 'no', 'lost_stolen'] },
  { id: 'phone', type: 'single', options: ['yes_works', 'yes_no_service', 'no'] },

  { id: 'services_used', type: 'multi', options: ['food_pantry', 'meals', 'shelter', 'day_center', 'health_clinic', 'mental_health', 'addiction_treatment', 'job_help', 'housing_help', 'id_help', 'showers_laundry', 'transportation', 'none'] },
  { id: 'services_barriers', type: 'multi', options: ['hours', 'transportation', 'rules', 'no_pets', 'waitlist', 'no_id', 'full', 'feel_unsafe', 'dont_know_where', 'no_phone', 'other'] },
  { id: 'services_missing', type: 'text' },

  { id: 'council_message', type: 'text' },
];

const TEXT_MAX_LENGTH = 2000;

// Turns whatever the client sent into a clean answers object: unknown
// questions and option codes are dropped, multi answers are de-duplicated,
// and "prefer not to say" can't be combined with other choices.
function sanitizeAnswers(raw) {
  const clean = {};
  if (!raw || typeof raw !== 'object') return clean;

  for (const q of SURVEY_QUESTIONS) {
    const value = raw[q.id];
    if (value === undefined || value === null) continue;

    if (q.type === 'single') {
      if (typeof value === 'string' && (q.options.includes(value) || value === PREFER_NOT)) {
        clean[q.id] = value;
      }
    } else if (q.type === 'multi') {
      if (!Array.isArray(value)) continue;
      if (value.includes(PREFER_NOT)) {
        clean[q.id] = [PREFER_NOT];
        continue;
      }
      const picked = [...new Set(value.filter((v) => typeof v === 'string' && q.options.includes(v)))];
      if (picked.length) clean[q.id] = picked;
    } else if (q.type === 'text') {
      if (typeof value === 'string' && value.trim()) {
        clean[q.id] = value.trim().slice(0, TEXT_MAX_LENGTH);
      }
    }
  }

  // Only meaningful when kids were checked under "who's with you".
  if (clean.kids_count && !(clean.with_you || []).includes('kids')) {
    delete clean.kids_count;
  }

  return clean;
}

module.exports = { SURVEY_QUESTIONS, SURVEY_LANGUAGES, PREFER_NOT, sanitizeAnswers };
