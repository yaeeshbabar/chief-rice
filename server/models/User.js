import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["admin", "salesman"], required: true },
    // Logins made before this time stop working (set whenever the password changes).
    passwordChangedAt: { type: Date },
    // A login that is turned off can't sign in (records keep the person's name).
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  // A second back so a login made right after the change still counts as newer.
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

export default mongoose.model("User", userSchema);
