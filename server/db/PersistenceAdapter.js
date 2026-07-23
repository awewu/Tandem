/**
 * PersistenceAdapter — 统一数据访问层
 *
 * 提供与原内存 db 完全兼容的读写接口：
 *   getAll(collection)
 *   getById(collection, id)
 *   findOne(collection, predicate)
 *   findMany(collection, predicate)
 *   insert(collection, doc)
 *   updateById(collection, id, patch)
 *   deleteById(collection, id)
 *   upsertById(collection, id, doc)
 *
 * MONGO 模式：操作真实 MongoDB collection（collection name 映射到 model）
 * MEMORY 模式：操作传入的 memDb 对象（原 server-production.js 的 db）
 *
 * 集合名称与 Mongoose 模型的映射在 MODEL_MAP 中定义
 */

const { isConnected } = require('./index');

// ── Mongoose 模型映射 ──────────────────────────────────────────────────────────
// key = memDb 集合名, value = 对应 mongoose model（懒加载防循环依赖）
const MODEL_MAP = {
  customers: () => require('../models/customer.model'),
  contracts: () => require('../models/contract.model'),
  products:  () => require('../models/Product'),
  quotes:    () => require('../models/Quotation'),
  users:     () => require('../models/User'),
};

function getModel(collection) {
  const factory = MODEL_MAP[collection];
  if (!factory) return null;
  try { return factory(); } catch { return null; }
}

// ── 内存模式 CRUD ─────────────────────────────────────────────────────────────
class MemoryAdapter {
  constructor(memDb) { this.db = memDb; }

  _col(name) { return this.db[name] || []; }

  getAll(col)              { return Promise.resolve([...this._col(col)]); }
  getById(col, id)         { return Promise.resolve(this._col(col).find(x => x.id === id || x._id == id) || null); }
  findOne(col, fn)         { return Promise.resolve(this._col(col).find(fn) || null); }
  findMany(col, fn)        { return Promise.resolve(fn ? this._col(col).filter(fn) : [...this._col(col)]); }

  insert(col, doc) {
    if (!this.db[col]) this.db[col] = [];
    this.db[col].push(doc);
    return Promise.resolve(doc);
  }

  updateById(col, id, patch) {
    const arr = this.db[col] || [];
    const idx = arr.findIndex(x => x.id === id || x._id == id);
    if (idx === -1) return Promise.resolve(null);
    arr[idx] = { ...arr[idx], ...patch, updatedAt: new Date().toISOString() };
    return Promise.resolve(arr[idx]);
  }

  deleteById(col, id) {
    if (!this.db[col]) return Promise.resolve(false);
    const len = this.db[col].length;
    this.db[col] = this.db[col].filter(x => x.id !== id && x._id != id);
    return Promise.resolve(this.db[col].length < len);
  }

  upsertById(col, id, doc) {
    if (!this.db[col]) this.db[col] = [];
    const idx = this.db[col].findIndex(x => x.id === id || x._id == id);
    if (idx === -1) {
      this.db[col].push({ ...doc, id });
      return Promise.resolve({ ...doc, id });
    }
    this.db[col][idx] = { ...this.db[col][idx], ...doc, updatedAt: new Date().toISOString() };
    return Promise.resolve(this.db[col][idx]);
  }
}

// ── MongoDB 模式 CRUD ─────────────────────────────────────────────────────────
class MongoAdapter {
  _model(col) {
    const m = getModel(col);
    if (!m) throw new Error(`No Mongoose model for collection: ${col}`);
    return m;
  }

  async getAll(col) {
    try { return await this._model(col).find({}).lean(); }
    catch { return []; }
  }

  async getById(col, id) {
    try {
      const m = this._model(col);
      return await m.findOne({ $or: [{ _id: id }, { id }] }).lean();
    } catch { return null; }
  }

  async findOne(col, filter) {
    try {
      const m = this._model(col);
      const q = typeof filter === 'function' ? null : filter;
      if (!q) return null;
      return await m.findOne(q).lean();
    } catch { return null; }
  }

  async findMany(col, filter) {
    try {
      const m = this._model(col);
      const q = (filter && typeof filter !== 'function') ? filter : {};
      return await m.find(q).lean();
    } catch { return []; }
  }

  async insert(col, doc) {
    try {
      const m = this._model(col);
      const record = new m(doc);
      return (await record.save()).toObject();
    } catch { return doc; }
  }

  async updateById(col, id, patch) {
    try {
      const m = this._model(col);
      return await m.findOneAndUpdate(
        { $or: [{ _id: id }, { id }] },
        { ...patch, updatedAt: new Date() },
        { new: true, lean: true }
      );
    } catch { return null; }
  }

  async deleteById(col, id) {
    try {
      const m = this._model(col);
      const r = await m.deleteOne({ $or: [{ _id: id }, { id }] });
      return r.deletedCount > 0;
    } catch { return false; }
  }

  async upsertById(col, id, doc) {
    try {
      const m = this._model(col);
      return await m.findOneAndUpdate(
        { $or: [{ _id: id }, { id }] },
        { ...doc, updatedAt: new Date() },
        { new: true, upsert: true, lean: true }
      );
    } catch { return doc; }
  }
}

// ── 工厂：根据当前模式返回正确适配器 ──────────────────────────────────────────
let _adapter = null;

function getAdapter(memDb) {
  if (!_adapter) {
    _adapter = isConnected() ? new MongoAdapter() : new MemoryAdapter(memDb);
    console.log(`[PersistenceAdapter] 模式 = ${isConnected() ? 'MongoDB' : 'Memory'}`);
  }
  return _adapter;
}

function resetAdapter() { _adapter = null; }

module.exports = { getAdapter, resetAdapter, MemoryAdapter, MongoAdapter };
