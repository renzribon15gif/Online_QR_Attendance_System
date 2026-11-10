const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  attendanceSession: { type: mongoose.Schema.Types.ObjectId, ref: "AttendanceSession", required: true },
  status: { type: String, enum: ["Present"], default: "Present" },
  scannedAt: { type: Date, default: Date.now }
}, { timestamps: true });

attendanceSchema.index({ student: 1, attendanceSession: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
