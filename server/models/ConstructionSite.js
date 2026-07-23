const mongoose = require('mongoose')

// 工地管理数据模型
const constructionSiteSchema = new mongoose.Schema({
  // 基础信息
  name: { type: String, required: true },
  code: { type: String, unique: true }, // 工地编号
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  
  // 地址信息
  address: {
    province: String,
    city: String,
    district: String,
    street: String,
    detail: String,
    latitude: Number, // GPS纬度
    longitude: Number // GPS经度
  },
  
  // 工地状态
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'paused', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  // 施工阶段
  stage: {
    type: String,
    enum: ['preparation', 'water_electric', 'waterproof', 'masonry', 'woodwork', 'paint', 'installation', 'completion'],
    default: 'preparation'
  },
  
  // 负责人
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // 客户信息
  customer: {
    name: String,
    phone: String,
    wechat: String
  },
  
  // 施工信息
  construction: {
    startDate: Date,
    plannedEndDate: Date,
    actualEndDate: Date,
    totalArea: Number, // 施工面积
    floors: Number,
    houseType: String // 户型
  },
  
  // 现场照片
  photos: [{
    url: String,
    type: { type: String, enum: ['overview', 'detail', 'problem', 'completion'] },
    description: String,
    takenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    takenAt: { type: Date, default: Date.now },
    location: {
      latitude: Number,
      longitude: Number
    }
  }],
  
  // 进度记录
  progress: [{
    stage: String,
    percentage: { type: Number, min: 0, max: 100 },
    description: String,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now }
  }],
  
  // 备注
  remarks: String,
  
  // 创建更新
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
})

// 索引
constructionSiteSchema.index({ code: 1 })
constructionSiteSchema.index({ project: 1 })
constructionSiteSchema.index({ status: 1 })
constructionSiteSchema.index({ 'address.city': 1 })

module.exports = mongoose.model('ConstructionSite', constructionSiteSchema)
