/**
 * Jest测试环境初始化
 */

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/rheem_test';

// 全局测试工具
global.testUtils = {
  // 创建模拟请求对象
  createMockReq: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides
  }),
  
  // 创建模拟响应对象
  createMockRes: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
  },
  
  // 等待指定时间
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// 全局前置
beforeAll(async () => {
  console.log('🧪 测试环境初始化完成');
});

// 全局后置
afterAll(async () => {
  console.log('🧹 测试环境清理完成');
});
