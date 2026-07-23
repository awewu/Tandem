/**
 * 数据库持久化引擎
 * 
 * 功能：
 * 1. 用户数据持久化
 * 2. 方案数据持久化
 * 3. 产品数据持久化
 * 4. 配置数据持久化
 * 5. 数据备份和恢复
 */

const fs = require('fs');
const path = require('path');

class DatabasePersistenceEngine {
  constructor() {
    this.dbPath = path.join(__dirname, '../../database');
    this.dataFiles = {
      users: path.join(this.dbPath, 'users.json'),
      solutions: path.join(this.dbPath, 'solutions.json'),
      products: path.join(this.dbPath, 'products.json'),
      config: path.join(this.dbPath, 'config.json')
    };
    
    // 初始化数据库目录
    this.initializeDatabase();
  }

  /**
   * 初始化数据库
   */
  initializeDatabase() {
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
      console.log('✅ 数据库目录已创建');
    }
    
    // 初始化数据文件
    Object.entries(this.dataFiles).forEach(([key, filePath]) => {
      if (!fs.existsSync(filePath)) {
        const initialData = this.getInitialData(key);
        fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
        console.log(`✅ ${key} 数据文件已初始化`);
      }
    });
  }

  /**
   * 获取初始数据
   */
  getInitialData(type) {
    switch (type) {
      case 'users':
        return [
          {
            id: 1,
            phone: '13900000000',
            password: '123456',
            role: 'store_admin',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 2,
            phone: '13800000000',
            password: '123456',
            role: 'designer',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 3,
            phone: '13700000000',
            password: '123456',
            role: 'sales',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 4,
            phone: '13600000000',
            password: '123456',
            role: 'hq_admin',
            status: 'active',
            createdAt: new Date().toISOString()
          },
          {
            id: 5,
            phone: '13500000000',
            password: '123456',
            role: 'rheem_official',
            status: 'active',
            createdAt: new Date().toISOString()
          }
        ];
      
      case 'solutions':
        return [];
      
      case 'products':
        return [];
      
      case 'config':
        return {
          logo: '/images/rheem-logo.png',
          primaryColor: '#C41230',
          fontFamily: 'Source Han Sans',
          logRetentionDays: 30,
          syncIntervalMinutes: 5,
          baseDiscount: 0.85,
          minMargin: 0.25
        };
      
      default:
        return [];
    }
  }

  /**
   * 读取数据
   */
  readData(type) {
    try {
      const filePath = this.dataFiles[type];
      if (!fs.existsSync(filePath)) {
        return this.getInitialData(type);
      }
      
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`读取${type}数据失败:`, error);
      return this.getInitialData(type);
    }
  }

  /**
   * 写入数据
   */
  writeData(type, data) {
    try {
      const filePath = this.dataFiles[type];
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`写入${type}数据失败:`, error);
      return false;
    }
  }

  /**
   * 用户数据持久化
   */
  // 获取所有用户
  getAllUsers() {
    return this.readData('users');
  }

  // 获取单个用户
  getUserById(userId) {
    const users = this.readData('users');
    return users.find(user => user.id === parseInt(userId));
  }

  // 根据手机号获取用户
  getUserByPhone(phone) {
    const users = this.readData('users');
    return users.find(user => user.phone === phone);
  }

  // 创建用户
  createUser(userData) {
    const users = this.readData('users');
    const newUser = {
      id: users.length + 1,
      ...userData,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    this.writeData('users', users);
    return newUser;
  }

  // 更新用户
  updateUser(userId, updates) {
    const users = this.readData('users');
    const index = users.findIndex(user => user.id === parseInt(userId));
    
    if (index !== -1) {
      users[index] = { ...users[index], ...updates, updatedAt: new Date().toISOString() };
      this.writeData('users', users);
      return users[index];
    }
    
    return null;
  }

  // 删除用户
  deleteUser(userId) {
    const users = this.readData('users');
    const index = users.findIndex(user => user.id === parseInt(userId));
    
    if (index !== -1) {
      const deletedUser = users.splice(index, 1)[0];
      this.writeData('users', users);
      return deletedUser;
    }
    
    return null;
  }

  /**
   * 方案数据持久化
   */
  // 获取所有方案
  getAllSolutions() {
    return this.readData('solutions');
  }

  // 获取用户方案
  getSolutionsByUserId(userId) {
    const solutions = this.readData('solutions');
    return solutions.filter(solution => solution.userId === parseInt(userId));
  }

  // 创建方案
  createSolution(solutionData) {
    const solutions = this.readData('solutions');
    const newSolution = {
      id: solutions.length + 1,
      ...solutionData,
      createdAt: new Date().toISOString()
    };
    solutions.push(newSolution);
    this.writeData('solutions', solutions);
    return newSolution;
  }

  // 更新方案
  updateSolution(solutionId, updates) {
    const solutions = this.readData('solutions');
    const index = solutions.findIndex(solution => solution.id === parseInt(solutionId));
    
    if (index !== -1) {
      solutions[index] = { ...solutions[index], ...updates, updatedAt: new Date().toISOString() };
      this.writeData('solutions', solutions);
      return solutions[index];
    }
    
    return null;
  }

  // 删除方案
  deleteSolution(solutionId) {
    const solutions = this.readData('solutions');
    const index = solutions.findIndex(solution => solution.id === parseInt(solutionId));
    
    if (index !== -1) {
      const deletedSolution = solutions.splice(index, 1)[0];
      this.writeData('solutions', solutions);
      return deletedSolution;
    }
    
    return null;
  }

  /**
   * 产品数据持久化
   */
  // 获取所有产品
  getAllProducts() {
    return this.readData('products');
  }

  // 根据品牌获取产品
  getProductsByBrand(brand) {
    const products = this.readData('products');
    return products.filter(product => product.brand === brand);
  }

  // 根据类型获取产品
  getProductsByType(type) {
    const products = this.readData('products');
    return products.filter(product => product.type === type);
  }

  // 创建产品
  createProduct(productData) {
    const products = this.readData('products');
    const newProduct = {
      id: products.length + 1,
      ...productData,
      createdAt: new Date().toISOString()
    };
    products.push(newProduct);
    this.writeData('products', products);
    return newProduct;
  }

  // 更新产品
  updateProduct(productId, updates) {
    const products = this.readData('products');
    const index = products.findIndex(product => product.id === parseInt(productId));
    
    if (index !== -1) {
      products[index] = { ...products[index], ...updates, updatedAt: new Date().toISOString() };
      this.writeData('products', products);
      return products[index];
    }
    
    return null;
  }

  // 删除产品
  deleteProduct(productId) {
    const products = this.readData('products');
    const index = products.findIndex(product => product.id === parseInt(productId));
    
    if (index !== -1) {
      const deletedProduct = products.splice(index, 1)[0];
      this.writeData('products', products);
      return deletedProduct;
    }
    
    return null;
  }

  /**
   * 配置数据持久化
   */
  // 获取配置
  getConfig() {
    return this.readData('config');
  }

  // 更新配置
  updateConfig(configUpdates) {
    const config = this.readData('config');
    const updatedConfig = { ...config, ...configUpdates, updatedAt: new Date().toISOString() };
    this.writeData('config', updatedConfig);
    return updatedConfig;
  }

  /**
   * 数据备份
   */
  backupData() {
    try {
      const backupPath = path.join(this.dbPath, '../backups');
      if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(backupPath, `backup-${timestamp}.json`);
      
      const backupData = {
        timestamp: new Date().toISOString(),
        users: this.readData('users'),
        solutions: this.readData('solutions'),
        products: this.readData('products'),
        config: this.readData('config')
      };
      
      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
      
      return {
        success: true,
        backupFile: backupFile,
        timestamp: backupData.timestamp
      };
    } catch (error) {
      console.error('数据备份失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 数据恢复
   */
  restoreData(backupFile) {
    try {
      if (!fs.existsSync(backupFile)) {
        return {
          success: false,
          error: '备份文件不存在'
        };
      }
      
      const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      
      // 恢复数据
      this.writeData('users', backupData.users || []);
      this.writeData('solutions', backupData.solutions || []);
      this.writeData('products', backupData.products || []);
      this.writeData('config', backupData.config || {});
      
      return {
        success: true,
        timestamp: backupData.timestamp
      };
    } catch (error) {
      console.error('数据恢复失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取备份列表
   */
  getBackupList() {
    try {
      const backupPath = path.join(this.dbPath, '../backups');
      if (!fs.existsSync(backupPath)) {
        return [];
      }
      
      const files = fs.readdirSync(backupPath)
        .filter(file => file.startsWith('backup-') && file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(backupPath, file);
          const stats = fs.statSync(filePath);
          return {
            filename: file,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      
      return files;
    } catch (error) {
      console.error('获取备份列表失败:', error);
      return [];
    }
  }

  /**
   * 获取数据库状态
   */
  getStatus() {
    return {
      dbPath: this.dbPath,
      dataFiles: Object.entries(this.dataFiles).map(([key, filePath]) => ({
        type: key,
        path: filePath,
        exists: fs.existsSync(filePath),
        size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0
      })),
      backupCount: this.getBackupList().length
    };
  }
}

// 导出单例实例
const databasePersistenceEngine = new DatabasePersistenceEngine();

module.exports = databasePersistenceEngine;
