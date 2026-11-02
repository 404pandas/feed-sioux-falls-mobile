const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Admins, volunteers, and neighbors who want a personalized login. Guests
// who don't want an account can still use the public routes with no login.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["admin", "volunteer", "neighbor"],
      required: true,
    },
    pinHash: { type: String, required: true },
    active: { type: Boolean, default: true },
    // Goes up each time the PIN is changed. Logins remember the number they
    // were made with, so a new PIN logs that person out on every phone and
    // browser (e.g. after a lost phone) - see middleware/auth.js.
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Call this instead of setting pinHash directly, so the PIN is always hashed.
userSchema.methods.setPin = async function setPin(rawPin) {
  const salt = await bcrypt.genSalt(10);
  this.pinHash = await bcrypt.hash(rawPin, salt);
  if (!this.isNew) this.sessionVersion = (this.sessionVersion || 0) + 1;
};

userSchema.methods.comparePin = function comparePin(rawPin) {
  return bcrypt.compare(rawPin, this.pinHash);
};

// Never send pinHash to the client, even by accident.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.pinHash;
    delete ret.sessionVersion;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
