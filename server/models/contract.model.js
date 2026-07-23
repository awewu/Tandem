const mongoose = require('mongoose');

const materialItemSchema = new mongoose.Schema({
  name:       String, model: String,
  quantity:   Number, unitPrice: Number, totalPrice: Number, supplier: String
}, { _id: false });

const materialCategorySchema = new mongoose.Schema({
  category: String, items: [materialItemSchema]
}, { _id: false });

const constructionLogSchema = new mongoose.Schema({
  date: String, phase: String, description: String, status: String
}, { _id: false });

const contractSchema = new mongoose.Schema({
  id:                 { type: String, required: true, unique: true },
  contractNumber:     { type: String },
  customerId:         { type: String },
  customerPhone:      { type: String },
  customerName:       { type: String },
  projectAddress:     { type: String },
  houseType:          { type: String },
  area:               { type: Number },
  systems:            [{ type: String }],
  totalPrice:         { type: Number },
  status:             { type: String, enum: ['draft','in_progress','completed','cancelled'], default: 'draft' },
  signedAt:           { type: Date },
  expectedCompletion: { type: String },
  actualCompletion:   { type: String },
  salesId:            { type: Number },
  designerId:         { type: Number },
  materials:          [materialCategorySchema],
  drawings:           [{ type: mongoose.Schema.Types.Mixed }],
  constructionLogs:   [constructionLogSchema],
  currentPhase:       { type: Number, default: 0 },
}, { timestamps: true });

contractSchema.index({ customerId: 1 });
contractSchema.index({ customerPhone: 1 });
contractSchema.index({ status: 1 });

module.exports = mongoose.models.Contract || mongoose.model('Contract', contractSchema);
