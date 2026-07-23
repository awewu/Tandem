/** sanitize-error helper 单元测试 */
const { sanitize, errorResponse, asyncRoute } = require('../../server/utils/sanitize-error');

describe('sanitize-error', () => {
  const origEnv = process.env.NODE_ENV;
  let consoleErrorSpy;

  beforeEach(() => { consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { consoleErrorSpy.mockRestore(); process.env.NODE_ENV = origEnv; });

  describe('sanitize()', () => {
    it('生产环境不泄漏 err.message', () => {
      process.env.NODE_ENV = 'production';
      const r = sanitize(new Error('数据库连接失败 at line 42'));
      expect(r.success).toBe(false);
      expect(r.error).toBe('服务暂时不可用');
      expect(r.error).not.toContain('数据库');
      expect(r.errorId).toMatch(/^ERR-\d+-\d+$/);
    });

    it('开发环境透传 err.message', () => {
      process.env.NODE_ENV = 'development';
      const r = sanitize(new Error('debug-message'));
      expect(r.error).toBe('debug-message');
      expect(r.errorId).toBeDefined();
    });

    it('支持自定义 fallbackMessage', () => {
      process.env.NODE_ENV = 'production';
      const r = sanitize(new Error('x'), '自定义错误提示');
      expect(r.error).toBe('自定义错误提示');
    });

    it('生产环境始终调用 console.error 记录全部信息', () => {
      process.env.NODE_ENV = 'production';
      sanitize(new Error('敏感信息'));
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('敏感信息');
    });
  });

  describe('errorResponse()', () => {
    it('返回自定义 status (默认500)', () => {
      process.env.NODE_ENV = 'production';
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      errorResponse(res, new Error('x'), 404);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, errorId: expect.any(String) }));
    });
  });

  describe('asyncRoute()', () => {
    it('捕获异步 handler 抛出的异常', done => {
      process.env.NODE_ENV = 'production';
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(r => {
          expect(r.success).toBe(false);
          expect(r.error).toBe('服务暂时不可用');
          done();
        })
      };
      const handler = asyncRoute(async () => { throw new Error('异步崩溃'); });
      handler({}, res, () => {});
    });

    it('成功 handler 正常执行', async () => {
      const res = { json: jest.fn() };
      const handler = asyncRoute(async (req, r) => { r.json({ ok: true }); });
      await handler({}, res, () => {});
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });
});
