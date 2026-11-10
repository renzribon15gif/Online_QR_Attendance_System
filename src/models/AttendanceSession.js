const mongoose = require("mongoose");

const attendanceSessionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  token: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

module.exports = mongoose.model("AttendanceSession", attendanceSessionSchema);
