const crypto = require('crypto');
const mongoose = require('mongoose');
const { SURVEY_LANGUAGES } = require('../utils/surveyQuestions');

// One anonymous community survey response. Stores no name, contact info,
// IP address, user id, or precise location - contact requests live in
// their own collection (SurveyContactRequest) with no link back to this.
//
// Two details keep a response from being matched to a contact request
// submitted at the same moment:
// - _id is a random UUID instead of an ObjectId, because ObjectIds embed
//   their creation time to the second.
// - submittedOn is the day only (UTC midnight), which is all the
//   counts-over-time reporting needs. No `timestamps` for the same reason.
const surveyResponseSchema = new mongoose.Schema({
  _id: { type: String, default: () => crypto.randomUUID() },
  // Sanitized against utils/surveyQuestions.js before saving.
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  language: { type: String, enum: SURVEY_LANGUAGES, default: 'en' },
  // self = on their own; volunteer = a volunteer helped them fill it out
  // in person; paper = a volunteer typed in a paper form afterward.
  source: { type: String, enum: ['self', 'volunteer', 'paper'], default: 'self' },
  submittedOn: { type: Date, required: true, index: true },
});

module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);
