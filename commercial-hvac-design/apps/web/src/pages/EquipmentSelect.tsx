import { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Badge, List, Tag, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircleOutlined, ThunderboltOutlined, DollarOutlined } from '@ant-design/icons';

const API_URL = 'http://localhost:3002/api';

const EquipmentSelect = () => {
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<string | null>(null);

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    const result = localStorage.getItem('calculationResult');
    if (!result) {
      message.warning('请先完成负荷计算');
      navigate('/project/create');
      return;
    }

    const calculation = JSON.parse(result);

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/equipment/recommend`, {
        heatConsumption: calculation.designHourlyHeatConsumption,
        ambientTemp: calculation.parameters['tl (冷水温度 ℃)'] > 15 ? 15 : 5,
        redundancy: 1.1,
      });

      if (response.data.success) {
        setSchemes(response.data.data.schemes);
      }
    } catch (error) {
      message.error('获取推荐方案失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (schemeName: string) => {
    setSelectedScheme(schemeName);
    message.success(`已选择「${schemeName}」方案`);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '24px' }}>🎯 设备选型方案推荐</h2>
      
      <Row gutter={[16, 16]}>
        {schemes.map((scheme, index) => (
          <Col span={8} key={scheme.name}>
            <Card
              hoverable
              loading={loading}
              style={{
                border: selectedScheme === scheme.name ? '2px solid #1a5fb4' : '1px solid #e8e8e8',
                background: selectedScheme === scheme.name ? '#e6f4ff' : '#fff',
              }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {index === 1 && <Badge count="推荐" style={{ backgroundColor: '#52c41a' }} />}
                  <span>{scheme.name}</span>
                </div>
              }
              actions={[
                <Button 
                  type={selectedScheme === scheme.name ? 'primary' : 'default'}
                  block
                  onClick={() => handleSelect(scheme.name)}
                  icon={selectedScheme === scheme.name ? <CheckCircleOutlined /> : null}
                >
                  {selectedScheme === scheme.name ? '已选择' : '选择此方案'}
                </Button>,
              ]}
            >
              <p style={{ color: '#666', marginBottom: '16px' }}>{scheme.description}</p>
              
              <List
                size="small"
                dataSource={scheme.equipment}
                renderItem={(item: any) => (
                  <List.Item>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{item.brand} {item.model}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {item.type} · {item.heatingPower}kW · COP{item.copHeating}
                      </div>
                      {item.note && <Tag color="blue" style={{ marginTop: '4px' }}>{item.note}</Tag>}
                    </div>
                  </List.Item>
                )}
              />

              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e8e8e8' }}>
                <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <ThunderboltOutlined style={{ color: '#faad14', fontSize: '20px' }} />
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>总功率</div>
                      <div style={{ fontWeight: 'bold' }}>{scheme.totalPower}kW</div>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <DollarOutlined style={{ color: '#52c41a', fontSize: '20px' }} />
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>总价</div>
                      <div style={{ fontWeight: 'bold' }}>¥{scheme.totalPrice.toLocaleString()}</div>
                    </div>
                  </Col>
                </Row>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {schemes.length === 0 && !loading && (
        <Card style={{ textAlign: 'center', padding: '48px' }}>
          <p>暂无推荐方案，请先完成负荷计算</p>
          <Button type="primary" onClick={() => navigate('/project/create')}>
            返回计算
          </Button>
        </Card>
      )}

      <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
        <Button size="large" onClick={() => navigate('/calculation/result')}>
          ← 返回计算结果
        </Button>
        <Button 
          type="primary" 
          size="large"
          disabled={!selectedScheme}
          onClick={() => message.success('方案已保存！完整功能开发中...')}
        >
          导出设计方案
        </Button>
      </div>
    </div>
  );
};

export default EquipmentSelect;
