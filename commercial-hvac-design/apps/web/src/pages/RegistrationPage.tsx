import { useState, useEffect } from 'react';
import { Card, Table, Button, Badge, Tag, Modal, Form, Input, Select, DatePicker, Timeline, Statistic, Row, Col, message, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  PlusOutlined, 
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  DollarOutlined,
  TeamOutlined,
} from '@ant-design/icons';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

const API_URL = 'http://localhost:3002/api';

// 报备状态映射
const statusMap: Record<string, { color: string; text: string; icon: any }> = {
  pending: { color: 'orange', text: '待审核', icon: <ClockCircleOutlined /> },
  approved: { color: 'green', text: '保护中', icon: <CheckCircleOutlined /> },
  rejected: { color: 'red', text: '已拒绝', icon: <WarningOutlined /> },
  expired: { color: 'gray', text: '已过期', icon: <ClockCircleOutlined /> },
  converted: { color: 'blue', text: '已成交', icon: <CheckCircleOutlined /> },
  lost: { color: 'gray', text: '已丢单', icon: <WarningOutlined /> },
};

const RegistrationPage = () => {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchRegistrations();
    fetchStats();
  }, []);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/registrations`, {
        params: activeTab !== 'all' ? { status: activeTab } : {}
      });
      if (response.data.success) {
        setRegistrations(response.data.data);
      }
    } catch (error) {
      message.error('获取报备列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/registrations/stats/overview`);
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('获取统计失败', error);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const response = await axios.post(`${API_URL}/registrations`, {
        ...values,
        dealerId: 'D001', // 当前登录经销商ID
        dealerName: '恒热上海分公司',
        estimatedAmount: Number(values.estimatedAmount),
        estimatedUnits: Number(values.estimatedUnits),
      });

      if (response.data.success) {
        message.success('项目报备成功！保护期30天');
        setModalVisible(false);
        form.resetFields();
        fetchRegistrations();
        fetchStats();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '报备失败');
    }
  };

  const handleConvert = async (id: string) => {
    try {
      await axios.post(`${API_URL}/registrations/${id}/convert`, {
        orderAmount: selectedRegistration?.estimatedAmount || 0,
      });
      message.success('已转为成交');
      fetchRegistrations();
      fetchStats();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleLost = async (id: string) => {
    const reason = window.prompt('请输入丢单原因：');
    if (reason) {
      try {
        await axios.post(`${API_URL}/registrations/${id}/lost`, { reason });
        message.success('已标记为丢单');
        fetchRegistrations();
        fetchStats();
      } catch (error) {
        message.error('操作失败');
      }
    }
  };

  const showDetail = (record: any) => {
    setSelectedRegistration(record);
    setDetailModalVisible(true);
  };

  const columns = [
    {
      title: '项目名称',
      dataIndex: 'projectName',
      key: 'projectName',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>{record.customerCompany}</div>
        </div>
      ),
    },
    {
      title: '客户信息',
      key: 'customer',
      render: (_: any, record: any) => (
        <div>
          <div><TeamOutlined /> {record.customerName}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <PhoneOutlined /> {record.customerPhone}
          </div>
        </div>
      ),
    },
    {
      title: '项目类型',
      dataIndex: 'projectType',
      key: 'projectType',
      render: (type: string) => <Tag>{type}</Tag>,
    },
    {
      title: '预估金额',
      dataIndex: 'estimatedAmount',
      key: 'estimatedAmount',
      render: (amount: number) => (
        <span style={{ color: '#f5222d', fontWeight: 'bold' }}>
          ¥{(amount / 10000).toFixed(1)}万
        </span>
      ),
    },
    {
      title: '报备日期',
      dataIndex: 'registrationDate',
      key: 'registrationDate',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '保护期到期',
      dataIndex: 'protectionExpiry',
      key: 'protectionExpiry',
      render: (date: string, record: any) => {
        const expiry = new Date(date);
        const now = new Date();
        const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 3600 * 24));
        
        if (record.status !== 'approved') return '-';
        
        return (
          <div>
            <div>{expiry.toLocaleDateString()}</div>
            <div style={{ fontSize: '12px', color: daysLeft <= 7 ? '#f5222d' : '#52c41a' }}>
              剩余 {daysLeft} 天
            </div>
          </div>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = statusMap[status];
        return (
          <Badge 
            status={config.color as any} 
            text={
              <span style={{ color: config.color === 'gray' ? '#999' : undefined }}>
                {config.icon} {config.text}
              </span>
            } 
          />
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button 
            type="primary" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => showDetail(record)}
          >
            详情
          </Button>
          {record.status === 'approved' && (
            <>
              <Button 
                type="primary" 
                size="small"
                onClick={() => handleConvert(record.id)}
              >
                成交
              </Button>
              <Button 
                danger 
                size="small"
                onClick={() => handleLost(record.id)}
              >
                丢单
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '24px' }}>📝 项目报备系统</h2>

      {/* 统计卡片 */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title="总报备数" value={stats.total} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic 
                title="保护中" 
                value={stats.approved} 
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic 
                title="已成交" 
                value={stats.converted} 
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="已丢单" value={stats.lost} />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic 
                title="转化率" 
                value={stats.conversionRate} 
                suffix="%"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic 
                title="报备总金额" 
                value={(stats.totalAmount / 10000).toFixed(1)} 
                suffix="万"
                prefix={<DollarOutlined />}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 报备列表 */}
      <Card 
        title="项目报备列表" 
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            新增报备
          </Button>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="全部" key="all" />
          <TabPane tab="保护中" key="approved" />
          <TabPane tab="待审核" key="pending" />
          <TabPane tab="已成交" key="converted" />
          <TabPane tab="已丢单" key="lost" />
        </Tabs>

        <Table
          dataSource={registrations}
          columns={columns}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 新增报备弹窗 */}
      <Modal
        title="新增项目报备"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="项目名称"
                name="projectName"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
                <Input placeholder="如：三亚度假酒店热水工程" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="项目类型"
                name="projectType"
                rules={[{ required: true, message: '请选择项目类型' }]}
              >
                <Select placeholder="选择项目类型">
                  <Option value="hotel">酒店宾馆</Option>
                  <Option value="hospital">医院</Option>
                  <Option value="school">学校</Option>
                  <Option value="gym">健身房</Option>
                  <Option value="apartment">公寓</Option>
                  <Option value="factory">工厂宿舍</Option>
                  <Option value="restaurant">餐饮</Option>
                  <Option value="swimming">游泳馆</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="客户名称"
                name="customerName"
                rules={[{ required: true, message: '请输入客户名称' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="联系电话"
                name="customerPhone"
                rules={[{ required: true, message: '请输入联系电话' }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="客户单位" name="customerCompany">
            <Input placeholder="客户所在公司或单位名称" />
          </Form.Item>

          <Form.Item
            label="项目地址"
            name="projectAddress"
            rules={[{ required: true, message: '请输入项目地址' }]}
          >
            <Input.TextArea rows={2} placeholder="详细地址，用于冲突检测" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="预估金额（元）"
                name="estimatedAmount"
                rules={[{ required: true, message: '请输入预估金额' }]}
              >
                <Input type="number" min={50000} placeholder="最低5万元" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="预估数量（客房/床位）"
                name="estimatedUnits"
                rules={[{ required: true, message: '请输入预估数量' }]}
              >
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="销售代表" name="salesRep">
            <Input placeholder="负责此项目的销售代表" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large">
              提交报备
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="项目报备详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedRegistration && (
          <div>
            <Row gutter={16} style={{ marginBottom: '16px' }}>
              <Col span={12}>
                <Card size="small" title="项目信息">
                  <p><strong>项目名称：</strong>{selectedRegistration.projectName}</p>
                  <p><strong>项目类型：</strong><Tag>{selectedRegistration.projectType}</Tag></p>
                  <p><strong>项目地址：</strong>{selectedRegistration.projectAddress}</p>
                  <p><strong>预估金额：</strong>
                    <span style={{ color: '#f5222d' }}>
                      ¥{selectedRegistration.estimatedAmount?.toLocaleString()}
                    </span>
                  </p>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="客户信息">
                  <p><strong>客户名称：</strong>{selectedRegistration.customerName}</p>
                  <p><strong>联系电话：</strong>{selectedRegistration.customerPhone}</p>
                  <p><strong>客户单位：</strong>{selectedRegistration.customerCompany || '-'}</p>
                  <p><strong>销售代表：</strong>{selectedRegistration.salesRep || '-'}</p>
                </Card>
              </Col>
            </Row>

            <Card size="small" title="报备进度" style={{ marginBottom: '16px' }}>
              <Timeline>
                <Timeline.Item color="green">
                  <p><strong>报备提交</strong></p>
                  <p>{new Date(selectedRegistration.registrationDate).toLocaleString()}</p>
                </Timeline.Item>
                {selectedRegistration.approvalDate && (
                  <Timeline.Item color="blue">
                    <p><strong>审核通过</strong></p>
                    <p>{new Date(selectedRegistration.approvalDate).toLocaleString()}</p>
                  </Timeline.Item>
                )}
                <Timeline.Item color="gray">
                  <p><strong>保护期到期</strong></p>
                  <p>{new Date(selectedRegistration.protectionExpiry).toLocaleDateString()}</p>
                </Timeline.Item>
              </Timeline>
            </Card>

            {selectedRegistration.followUpLogs?.length > 0 && (
              <Card size="small" title="跟进记录">
                <Timeline>
                  {selectedRegistration.followUpLogs.map((log: any, idx: number) => (
                    <Timeline.Item key={idx}>
                      <p><strong>{log.type}</strong> - {new Date(log.date).toLocaleString()}</p>
                      <p>{log.content}</p>
                      {log.result && <p style={{ color: '#52c41a' }}>结果：{log.result}</p>}
                    </Timeline.Item>
                  ))}
                </Timeline>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RegistrationPage;
