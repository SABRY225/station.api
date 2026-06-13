const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema({
  stationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Station', required: true },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Attachment', AttachmentSchema);