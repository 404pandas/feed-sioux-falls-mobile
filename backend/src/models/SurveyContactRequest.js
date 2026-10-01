const mongoose = require('mongoose');
const { SURVEY_LANGUAGES } = require('../utils/surveyQuestions');

// Someone who checked "I'd like someone to contact me" on the community
// survey. Intentionally NOT linked to their SurveyResponse, so whoever
// follows up never sees that person's answers, and the answers stay
// anonymous. Only Feed Sioux Falls admins can read these - they are never
// part of what's shared with City Council.
const surveyContactRequestSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: null, maxlength: 200 },
    phone: { type: String, trim: true, default: null, maxlength: 50 },
    email: { type: String, trim: true, default: null, maxlength: 200 },
    bestTime: { type: String, trim: true, default: null, maxlength: 200 },
    // Matters for domestic violence survivors - if false, don't leave a
    // voicemail or message someone else could hear or read. null = they
    // didn't answer, so treat it as "no".
    safeToLeaveMessage: { type: Boolean, default: null },
    language: { type: String, enum: SURVEY_LANGUAGES, default: 'en' },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SurveyContactRequest', surveyContactRequestSchema);
