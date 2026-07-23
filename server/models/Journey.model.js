/**
 * Journey MongoDB Model
 * 2026-04-22 P1 MongoDB 持久化实施
 * 与 CustomerJourneyStore 保持 schema 对齐
 */
const mongoose = require('mongoose');

const StageSchema = new mongoose.Schema({
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  startedAt: Date,
  completedAt: Date,
  owner: String,
  data: mongoose.Schema.Types.Mixed,
  notes: String
}, { _id: false });

const CommunicationSchema = new mongoose.Schema({
  id: String,
  timestamp: { type: Date, default: Date.now },
  channel: String,
  direction: String,
  from: String,
  to: String,
  topic: String,
  content: String,
  nextAction: String,
  nextActionAt: Date
}, { _id: false });

const TimelineEventSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now },
  type: String,
  summary: String,
  note: String,
  actor: String
}, { _id: false });

const JourneySchema = new mongoose.Schema({
  caseId: { type: String, unique: true, index: true, required: true },
  customer: {
    name: String,
    phone: { type: String, index: true },
    city: { type: String, index: true },
    source: String,
    gender: String,
    age: Number
  },
  profile: mongoose.Schema.Types.Mixed,
  painPoints: [String],
  preferredTier: String,
  status: { type: String, index: true, default: 'open' },
  currentStage: String,
  stages: {
    diagnosis: StageSchema,
    lockin: StageSchema,
    deal: StageSchema,
    design: StageSchema,
    technical: StageSchema,
    construction: StageSchema,
    quotation: StageSchema
  },
  communications: [CommunicationSchema],
  timeline: [TimelineEventSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

JourneySchema.pre('save', function (next) { this.updatedAt = new Date(); next(); });
JourneySchema.index({ 'customer.name': 'text', 'customer.phone': 1, caseId: 1 });

module.exports = mongoose.models.Journey || mongoose.model('Journey', JourneySchema);
