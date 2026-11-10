const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  studentId: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["teacher", "admin", "student"], default: "student" }
}, { timestamps: true });
module.exports = mongoose.model("User", userSchema);
