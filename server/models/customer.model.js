const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  id:         { type: String, required: true, unique: true },
  phone:      { type: String, required: true, unique: true },
  name:       { type: String, required: true },
  houseType:  { type: String },
  area:       { type: Number },
  city:       { type: String },
  createdBy:  { type: Number },
  salesId:    { type: Number },
  designerId: { type: Number },
  tags:       [{ type: String }],
  notes:      { type: String },
}, { timestamps: true });

customerSchema.index({ phone: 1 });
customerSchema.index({ salesId: 1 });

module.exports = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
