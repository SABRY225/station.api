const mongoose = require('mongoose');

const StationSchema = new mongoose.Schema({
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  stationName: { type: String, required: true },
  governorate: { type: String, required: true },
  workerName: { type: String },
  electricityReading: { type: Number },
  gasReading: { type: Number },
  visitDate: { type: Date, required: true },
  status: { type: String, enum: ['Active', 'Inactive', 'Pending'], default: 'Active' },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Station', StationSchema);