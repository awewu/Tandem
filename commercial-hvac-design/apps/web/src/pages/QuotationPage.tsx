import { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Badge, Table, Tag, Collapse, message, Statistic } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  CheckCircleOutlined, 
  DollarOutlined, 
  FileTextOutlined,
  DownloadOutlined,
  ArrowRightOutlined,
  PieChartOutlined,
} from '@ant-design/icons';

const { Panel } = Collapse;

const API_URL = 'http://localhost:3002/api';

const QuotationPage = () => {
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<string | null>(null);

  useEffect(() => {
    generateQuotations();
  }, []);

  const generateQuotations = async () => {
    const result = localStorage.getItem('calculationResult');
    if (!result) {
      message.warning('请先完成负荷计算');
      navigate('/project/create');
      return;
    }

    const calculation = JSON.parse(result);

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/quotations/generate`, {
        equipmentPower: calculation.equipmentPower,
        storageVolume: calculation.storageTankVolume,
        pipeLength: 200, // 估算值
        unitCount: calculation.parameters['m (计算单位数)'] || 100,
        buildingType: 'hotel',
      });

      if (response.data.success) {
        setSchemes(response.data.data.schemes);
        // 默认选中标准型
        setSelectedScheme('standard');
      }
    } catch (error) {
      message.error('生成报价失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (scheme: any) => {
    try {
      const response = await axios.post(`${API_URL}/quotations/export`, {
        scheme,
        format: 'json',
      });

      if (response.data.success) {
        // 创建下载
        const dataStr = JSON.stringify(response.data.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `报价单-${scheme.name}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        message.success('报价单已导出');
      }
    } catch (error) {
      message.error('导出失败');
    }
  };

  const schemeColors: Record<string, string> = {
    basic: '#52c41a',
    standard: '#1890ff',
    premium: '#722ed1',
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '24px' }}>💰 经销商报价系统 - 三档方案</h2>
      
      {/* 方案对比卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '32px' }}>
        {schemes.map((scheme, index) => (
          <Col span={8} key={scheme.type}>
            <Card
              hoverable
              loading={loading}
              style={{
                border: selectedScheme === scheme.type ? `2px solid ${schemeColors[scheme.type]}` : '1px solid #e8e8e8',
                background: selectedScheme === scheme.type ? '#f6ffed' : '#fff',
                height: '100%',
              }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {scheme.type === 'standard' && <Badge count="推荐" style={{ backgroundColor: '#52c41a' }} />}
                  <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{scheme.name}</span>
                </div>
              }
              actions={[
                <Button 
                  type={selectedScheme === scheme.type ? 'primary' : 'default'}
                  block
                  onClick={() => setSelectedScheme(scheme.type)}
                  icon={selectedScheme === scheme.type ? <CheckCircleOutlined /> : null}
                >
                  {selectedScheme === scheme.type ? '已选择' : '选择此方案'}
                </Button>,
                <Button 
                  icon={<DownloadOutlined />}
                  onClick={() => handleExport(scheme)}
                >
                  导出报价
                </Button>,
              ]}
            >
              <p style={{ color: '#666', marginBottom: '16px' }}>{scheme.description}</p>
              
              {/* 客户匹配度 */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>客户匹配度</span>
                  <span style={{ color: schemeColors[scheme.type], fontWeight: 'bold' }}>{scheme.matchRate}%</span>
                </div>
                <div style={{ 
                  height: '8px', 
                  background: '#f0f0f0', 
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${scheme.matchRate}%`,
                    height: '100%',
                    background: schemeColors[scheme.type],
                    borderRadius: '4px',
                  }} />
                </div>
              </div>

              {/* 历史选择率 */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>历史选择率</span>
                  <span>{scheme.selectRate}%</span>
                </div>
                <div style={{ 
                  height: '8px', 
                  background: '#f0f0f0', 
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${scheme.selectRate}%`,
                    height: '100%',
                    background: '#faad14',
                    borderRadius: '4px',
                  }} />
                </div>
              </div>

              <Divider style={{ margin: '16px 0' }} />

              {/* 价格信息 */}
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <Statistic
                    title="总报价"
                    value={scheme.totalPrice}
                    suffix="元"
                    valueStyle={{ color: '#f5222d', fontSize: '20px' }}
                    prefix={<DollarOutlined />}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="单台造价"
                    value={scheme.unitPrice}
                    suffix="元"
                    valueStyle={{ fontSize: '16px' }}
                  />
                </Col>
              </Row>

              <Divider style={{ margin: '16px 0' }} />

              {/* 成本构成 */}
              <div style={{ fontSize: '12px', color: '#666' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>材料成本</span>
                  <span>¥{scheme.totalMaterialCost.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>人工成本</span>
                  <span>¥{scheme.totalLaborCost.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>利润率</span>
                  <span>{(scheme.profitMargin * 100).toFixed(0)}%</span>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 选中方案的详细信息 */}
      {selectedScheme && schemes.find(s => s.type === selectedScheme) && (
        <Card 
          title={
            <div>
              <FileTextOutlined /> 方案详情 - {schemes.find(s => s.type === selectedScheme)?.name}
            </div>
          }
          style={{ marginBottom: '24px' }}
        >
          <Collapse defaultActiveKey={['1', '2', '3']}>
            {/* 方案特点 */}
            <Panel header="✨ 方案特点" key="1">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {schemes.find(s => s.type === selectedScheme)?.features.map((feature: string, idx: number) => (
                  <Tag color="blue" key={idx}>{feature}</Tag>
                ))}
              </div>
            </Panel>

            {/* 材料清单 */}
            <Panel header="📦 材料清单" key="2">
              <Table
                dataSource={schemes.find(s => s.type === selectedScheme)?.materialCosts}
                pagination={false}
                size="small"
                columns={[
                  { title: '分类', dataIndex: 'category', key: 'category', width: 80 },
                  { title: '名称', dataIndex: 'name', key: 'name' },
                  { title: '型号', dataIndex: 'model', key: 'model' },
                  { title: '品牌', dataIndex: 'brand', key: 'brand', width: 100 },
                  { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
                  { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 60 },
                  { title: '成本价', dataIndex: 'unitCost', key: 'unitCost', render: (v: number) => `¥${v}`, width: 80 },
                  { title: '销售价', dataIndex: 'unitPrice', key: 'unitPrice', render: (v: number) => `¥${v}`, width: 80 },
                  { title: '备注', dataIndex: 'description', key: 'description', ellipsis: true },
                ]}
              />
            </Panel>

            {/* 人工清单 */}
            <Panel header="👷 人工清单" key="3">
              <Table
                dataSource={schemes.find(s => s.type === selectedScheme)?.laborCosts}
                pagination={false}
                size="small"
                columns={[
                  { title: '施工项目', dataIndex: 'item', key: 'item' },
                  { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
                  { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 80 },
                  { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', render: (v: number) => `¥${v}`, width: 100 },
                  { title: '总价', dataIndex: 'totalPrice', key: 'totalPrice', render: (v: number) => `¥${v}`, width: 100 },
                  { title: '说明', dataIndex: 'description', key: 'description' },
                ]}
              />
            </Panel>

            {/* ROI分析 */}
            <Panel header="📊 ROI投资回报分析" key="4">
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="年节省费用"
                      value={schemes.find(s => s.type === selectedScheme)?.annualSaving}
                      suffix="元/年"
                      valueStyle={{ color: '#52c41a' }}
                      prefix={<PieChartOutlined />}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <Statistic
                      title="投资回收期"
                      value={schemes.find(s => s.type === selectedScheme)?.paybackPeriod}
                      suffix="年"
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card size="small">
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>ROI分析</div>
                      <div style={{ fontSize: '14px', color: '#333' }}>
                        {schemes.find(s => s.type === selectedScheme)?.roiAnalysis}
                      </div>
                    </div>
                  </Card>
                </Col>
              </Row>
            </Panel>
          </Collapse>
        </Card>
      )}

      {schemes.length === 0 && !loading && (
        <Card style={{ textAlign: 'center', padding: '48px' }}>
          <p>暂无报价方案，请先完成负荷计算</p>
          <Button type="primary" onClick={() => navigate('/project/create')}>
            返回计算
          </Button>
        </Card>
      )}

      <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
        <Button size="large" onClick={() => navigate('/equipment/select')}>
          ← 返回设备选型
        </Button>
        <Button 
          type="primary" 
          size="large"
          icon={<ArrowRightOutlined />}
          disabled={!selectedScheme}
          onClick={() => navigate('/drawings/export')}
        >
          生成施工图纸 →
        </Button>
      </div>
    </div>
  );
};

// 分隔线组件
const Divider = ({ style }: { style?: React.CSSProperties }) => (
  <div style={{ height: '1px', background: '#e8e8e8', ...style }} />
);

export default QuotationPage;
