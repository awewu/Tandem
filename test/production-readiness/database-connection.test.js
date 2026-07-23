const mongoose = require('mongoose');

const dbLayer = require('../../server/db');

jest.mock('mongoose', () => ({
  connect: jest.fn(),
  connection: {
    readyState: 0
  }
}));

describe('database connection production fail-fast', () => {
  beforeEach(() => {
    dbLayer.resetForTests();
    jest.clearAllMocks();
  });

  test('development without MONGODB_URI stays in memory mode', async () => {
    const connected = await dbLayer.connect({
      env: { NODE_ENV: 'development' }
    });

    expect(connected).toBe(false);
    expect(dbLayer.getMode()).toBe('memory');
    expect(dbLayer.isConnected()).toBe(false);
    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  test('production without MONGODB_URI fails before serving traffic', async () => {
    await expect(dbLayer.connect({
      env: { NODE_ENV: 'production' }
    })).rejects.toThrow('MONGODB_URI is required');

    expect(dbLayer.getMode()).toBe('memory');
    expect(dbLayer.isConnected()).toBe(false);
    expect(mongoose.connect).not.toHaveBeenCalled();
  });

  test('REQUIRE_MONGODB=true fails on MongoDB connection errors outside production', async () => {
    mongoose.connect.mockRejectedValueOnce(new Error('server selection timeout'));

    await expect(dbLayer.connect({
      env: {
        NODE_ENV: 'development',
        REQUIRE_MONGODB: 'true',
        MONGODB_URI: 'mongodb://localhost:27017/rhautt-test',
        MONGODB_SERVER_SELECTION_TIMEOUT_MS: '1'
      }
    })).rejects.toThrow('MongoDB connection failed in required mode');

    expect(dbLayer.getMode()).toBe('memory');
    expect(dbLayer.isConnected()).toBe(false);
  });

  test('MongoDB connection success enters mongo mode', async () => {
    mongoose.connect.mockResolvedValueOnce({});

    const connected = await dbLayer.connect({
      env: {
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://user:pass@localhost:27017/rhautt'
      }
    });

    expect(connected).toBe(true);
    expect(dbLayer.getMode()).toBe('mongo');
    expect(dbLayer.isConnected()).toBe(true);
  });
});
