import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, Table, Collapse } from 'antd';
import { useNavigate } from 'react-router-dom';
import { 
  FireOutlined, 
  ThunderboltOutlined, 
  ExperimentOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
} from 'recharts';

const { Panel } = Collapse;

const CalculationResult = () => {
  const navigate = useNavigate();
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('calculationResult');
    if (stored) {
      setResult(JSON.parse(stored));
    }
  }, []);

  if (!result) {
    return (
      <Card title="计算结果">
        <p>暂无计算结果，请先创建项目并进行计算。</p>
        <Button type="primary" onClick={() => navigate('/project/create')}>
          新建项目
        </Button>
      </Card>
    );
  }

  const parameterColumns = [
    { title: '参数名称', dataIndex: 'name', key: 'name' },
    { title: '数值', dataIndex: 'value', key: 'value' },
  ];

  const parameterData = Object.entries(result.parameters).map(([key, value]) => ({
    key,
    name: key,
    value: String(value),
  }));

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '24px' }}>📊 热水负荷计算结果</h2>
      
      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="设计小时耗热量"
              value={result.designHourlyHeatConsumption}
              suffix="kW"
              valueStyle={{ color: '#1a5fb4' }}
              prefix={<FireOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="设计小时热水量"
              value={result.designHourlyWaterVolume}
              suffix="L/h"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="日耗热量"
              value={result.dailyHeatConsumption}
              suffix="kJ/d"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="设备功率需求"
              value={result.equipmentPower}
              suffix="kW"
              valueStyle={{ color: '#eb2f96' }}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 24小时负荷曲线 */}
      <Card title="📈 24小时热水需求曲线" style={{ marginBottom: '24px' }}>
        <div style={{ height: '400px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.curve24h}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hour" 
                label={{ value: '小时', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                yAxisId="left"
                label={{ value: '耗热量(kW)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                label={{ value: '热水量(L/h)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="heatConsumption"
                name="耗热量 (kW)"
                stroke="#1a5fb4"
                strokeWidth={2}
                dot={{ fill: '#1a5fb4' }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="waterVolume"
                name="热水量 (L/h)"
                stroke="#52c41a"
                strokeWidth={2}
                dot={{ fill: '#52c41a' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          {/* 计算公式说明 */}
          <Card title="📝 计算公式" style={{ marginBottom: '24px' }}>
            <Collapse defaultActiveKey={['1']}>
              <Panel header="设计小时耗热量公式" key="1">
                <p style={{ fontSize: '16px', fontFamily: 'monospace', background: '#f5f5f5', padding: '16px', borderRadius: '4px' }}>
                  {result.formula}
                </p>
                <p style={{ marginTop: '16px' }}>
                  <strong>Qh</strong> - 设计小时耗热量 (kW)<br />
                  <strong>Kh</strong> - 小时变化系数<br />
                  <strong>m</strong> - 计算单位数<br />
                  <strong>qr</strong> - 用水定额 (L/d)<br />
                  <strong>ΔT</strong> - 温度差 (℃)
                </p>
              </Panel>
            </Collapse>
          </Card>
        </Col>
        <Col span={12}>
          {/* 计算参数明细 */}
          <Card title="🔢 计算参数明细" style={{ marginBottom: '24px' }}>
            <Table
              dataSource={parameterData}
              columns={parameterColumns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 推荐设备 */}
      <Card title="🎯 推荐设备配置" style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card type="inner" title="储热水箱容积">
              <Statistic
                value={result.storageTankVolume}
                suffix="L"
                prefix={<ExperimentOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card type="inner" title="峰值时段">
              <Statistic
                value={result.peakHour}
                suffix=":00"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card type="inner" title="日用水量">
              <Statistic
                value={result.dailyWaterVolume}
                suffix="L/d"
              />
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
        <Button size="large" onClick={() => navigate('/project/create')}>
          ← 重新计算
        </Button>
        <Button 
          type="primary" 
          size="large"
          icon={<ArrowRightOutlined />}
          onClick={() => navigate('/equipment/select')}
        >
          查看设备选型 →
        </Button>
      </div>
    </div>
  );
};

export default CalculationResult;
