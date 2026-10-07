// Copied from feed-sioux-falls-website/src/survey/questions.js - keep the two in sync
// (and with backend/src/utils/surveyQuestions.js).
// Community survey structure. Ids and option codes must match the backend
// allowlist exactly (feed-sioux-falls/backend/src/utils/surveyQuestions.js) -
// anything the backend doesn't recognize is silently dropped.
//
// Wording lives in strings.js, keyed by these ids, so answers are stored as
// the same codes no matter which language someone used.

export const PREFER_NOT = 'prefer_not';

export const SECTIONS = [
  {
    id: 'start',
    questions: [{ id: 'repeat', type: 'single', options: ['first_time', 'yes_changed', 'yes_same'] }],
  },
  {
    id: 'where',
    questions: [
      { id: 'slept_last_night', type: 'single', options: ['shelter', 'outside', 'vehicle', 'couch', 'motel', 'own_place', 'hospital_jail_treatment', 'other'] },
      { id: 'area', type: 'single', options: ['downtown', 'northwest', 'northeast', 'southwest', 'southeast', 'outside_city', 'not_sure'] },
    ],
  },
  {
    id: 'housing',
    questions: [
      { id: 'housing_length', type: 'single', options: ['housed', 'under_1_month', '1_6_months', '6_12_months', '1_3_years', 'over_3_years'] },
      { id: 'first_time_homeless', type: 'single', options: ['yes', 'no'] },
      { id: 'time_in_sf', type: 'single', options: ['under_1_month', '1_12_months', '1_5_years', 'over_5_years', 'whole_life'] },
      { id: 'causes', type: 'multi', options: ['job_loss', 'rent_increase', 'eviction', 'domestic_violence', 'health', 'family', 'left_jail', 'left_foster_care', 'other'] },
    ],
  },
  {
    id: 'about',
    questions: [
      { id: 'age', type: 'single', options: ['under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus'] },
      { id: 'gender', type: 'multi', options: ['woman', 'man', 'nonbinary', 'transgender', 'two_spirit', 'other'] },
      { id: 'race', type: 'multi', options: ['american_indian', 'asian', 'black', 'hispanic', 'middle_eastern', 'pacific_islander', 'white', 'other'] },
      { id: 'with_you', type: 'multi', options: ['alone', 'partner', 'kids', 'other_family', 'friends', 'pets'] },
      {
        id: 'kids_count',
        type: 'single',
        options: ['1', '2', '3', '4', '5_plus'],
        showIf: (answers) => (answers.with_you || []).includes('kids'),
      },
    ],
  },
  {
    id: 'applies',
    questions: [
      { id: 'applies', type: 'multi', options: ['veteran', 'dv_survivor', 'disability', 'physical_health', 'mental_health', 'substance_use', 'pregnant', 'lgbtq', 'foster_youth', 'recently_released'] },
    ],
  },
  {
    id: 'work',
    questions: [
      { id: 'work', type: 'multi', options: ['full_time', 'part_time', 'day_labor', 'looking', 'unable', 'not_looking'] },
      { id: 'income', type: 'multi', options: ['job', 'ssi_ssdi', 'va', 'snap', 'tanf', 'unemployment', 'family_help', 'odd_jobs', 'none', 'other'] },
      { id: 'photo_id', type: 'single', options: ['yes', 'no', 'lost_stolen'] },
      { id: 'phone', type: 'single', options: ['yes_works', 'yes_no_service', 'no'] },
    ],
  },
  {
    id: 'services',
    questions: [
      { id: 'services_used', type: 'multi', options: ['food_pantry', 'meals', 'shelter', 'day_center', 'health_clinic', 'mental_health', 'addiction_treatment', 'job_help', 'housing_help', 'id_help', 'showers_laundry', 'transportation', 'none'] },
      { id: 'services_barriers', type: 'multi', options: ['hours', 'transportation', 'rules', 'no_pets', 'waitlist', 'no_id', 'full', 'feel_unsafe', 'dont_know_where', 'no_phone', 'other'] },
      { id: 'services_missing', type: 'text' },
    ],
  },
  {
    id: 'voice',
    questions: [{ id: 'council_message', type: 'text' }],
  },
  // The contact step is handled separately in SurveyPage - contact details
  // are sent apart from the answers and never stored with them.
  { id: 'contact', questions: [] },
];

export const ALL_QUESTIONS = SECTIONS.flatMap((s) => s.questions);

export function isVisible(question, answers) {
  return !question.showIf || question.showIf(answers);
}
