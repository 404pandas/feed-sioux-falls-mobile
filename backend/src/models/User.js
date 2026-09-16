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
  },
  { timestamps: true }
);

// Call this instead of setting pinHash directly, so the PIN is always hashed.
userSchema.methods.setPin = async function setPin(rawPin) {
  const salt = await bcrypt.genSalt(10);
  this.pinHash = await bcrypt.hash(rawPin, salt);
};

userSchema.methods.comparePin = function comparePin(rawPin) {
  return bcrypt.compare(rawPin, this.pinHash);
};

// Never send pinHash to the client, even by accident.
userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.pinHash;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
