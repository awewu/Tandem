import { Card, Row, Col, Typography, Button, Statistic, List } from 'antd';
import { Link } from 'react-router-dom';
import { 
  HotelOutlined, 
  MedicineBoxOutlined, 
  BankOutlined, 
  UserOutlined,
  PlusOutlined,
  HistoryOutlined,
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;

// 场景卡片数据
const sceneCards = [
  {
    id: 'hotel',
    title: '酒店',
    icon: <HotelOutlined style={{ fontSize: 48, color: '#1a5fb4' }} />,
    description: '客房热水系统、供暖制冷设计',
    color: '#e6f4ff',
  },
  {
    id: 'hospital',
    title: '医院',
    icon: <MedicineBoxOutlined style={{ fontSize: 48, color: '#52c41a' }} />,
    description: '病房热水、消毒供应、手术室空调',
    color: '#f6ffed',
  },
  {
    id: 'school',
    title: '学校',
    icon: <BankOutlined style={{ fontSize: 48, color: '#faad14' }} />,
    description: '宿舍热水、教学楼空调、食堂热水',
    color: '#fffbe6',
  },
  {
    id: 'gym',
    title: '健身房',
    icon: <UserOutlined style={{ fontSize: 48, color: '#eb2f96' }} />,
    description: '淋浴热水、泳池恒温、场馆空调',
    color: '#fff0f6',
  },
];

// 最近项目数据
const recentProjects = [
  { id: 1, name: '三亚度假酒店热水系统', type: '酒店', updated: '2天前' },
  { id: 2, name: '市立医院病房热水改造', type: '医院', updated: '1周前' },
  { id: 3, name: '大学城宿舍热水工程', type: '学校', updated: '2周前' },
];

const HomePage = () => {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* 欢迎区域 */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <Title level={2}>商用热水制冷智能设计平台</Title>
        <Paragraph type="secondary" style={{ fontSize: '16px' }}>
          AI驱动的多能互补设计方案，涵盖酒店、医院、学校等8大行业场景
        </Paragraph>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '48px' }}>
        <Col span={8}>
          <Card>
            <Statistic title="已服务项目" value={12000} suffix="+" />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="计算准确率" value={99.8} suffix="%" precision={1} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="节约设计时间" value={75} suffix="%" />
          </Card>
        </Col>
      </Row>

      {/* 场景选择 */}
      <Title level={4} style={{ marginBottom: '24px' }}>
        🏢 选择建筑场景
      </Title>
      <Row gutter={[16, 16]} style={{ marginBottom: '48px' }}>
        {sceneCards.map((card) => (
          <Col span={6} key={card.id}>
            <Link to={`/project/create?scene=${card.id}`}>
              <Card
                hoverable
                style={{ 
                  background: card.color,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                }}
                bodyStyle={{ textAlign: 'center', padding: '32px 24px' }}
              >
                <div style={{ marginBottom: '16px' }}>{card.icon}</div>
                <Title level={5}>{card.title}</Title>
                <Paragraph type="secondary" style={{ fontSize: '14px', marginTop: '8px' }}>
                  {card.description}
                </Paragraph>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>

      {/* 最近项目和快速操作 */}
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card
            title={<><HistoryOutlined /> 最近项目</>}
            extra={<Link to="/">查看全部</Link>}
          >
            <List
              dataSource={recentProjects}
              renderItem={(item) => (
                <List.Item
                  actions={[<Link to={`/project/${item.id}`}>编辑</Link>]}
                >
                  <List.Item.Meta
                    title={item.name}
                    description={`${item.type} · 更新于${item.updated}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="⚡ 快速开始">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Button type="primary" size="large" icon={<PlusOutlined />} block>
                新建设计项目
              </Button>
              <Button size="large" icon={<HistoryOutlined />} block>
                导入已有方案
              </Button>
              <Button size="large" block>
                查看设计规范
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default HomePage;
