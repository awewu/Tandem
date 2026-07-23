import { useState, useEffect } from 'react';
import { Card, Table, Button, Badge, Tag, Modal, Form, Input, Select, DatePicker, Steps, Statistic, Row, Col, Tabs, Timeline, message, Progress } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  PlusOutlined, 
  EyeOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  CarOutlined,
  ToolOutlined,
  SmileOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  UserOutlined,
  PhoneOutlined,
} from '@ant-design/icons';

const { Option } = Select;
const { Step } = Steps;
const { TabPane } = Tabs;
const { TextArea } = Input;

const API_URL = 'http://localhost:3002/api';

// 订单状态映射
const orderStatusMap: Record<string, { color: string; text: string; icon: any; step: number }> = {
  draft: { color: 'default', text: '草稿', icon: <FileTextOutlined />, step: 0 },
  pending: { color: 'warning', text: '待确认', icon: <SyncOutlined spin />, step: 1 },
  confirmed: { color: 'processing', text: '已确认', icon: <CheckCircleOutlined />, step: 2 },
  production: { color: 'blue', text: '生产中', icon: <SyncOutlined spin />, step: 3 },
  shipped: { color: 'purple', text: '已发货', icon: <CarOutlined />, step: 4 },
  installed: { color: 'cyan', text: '已安装', icon: <ToolOutlined />, step: 5 },
  completed: { color: 'success', text: '已完成', icon: <SmileOutlined />, step: 6 },
  cancelled: { color: 'error', text: '已取消', icon: <CloseCircleOutlined />, step: -1 },
};

// 付款状态映射
const paymentStatusMap: Record<string, { color: string; text: string }> = {
  unpaid: { color: 'error', text: '未付款' },
  deposit_paid: { color: 'warning', text: '定金已付' },
  partial_paid: { color: 'processing', text: '部分付款' },
  fully_paid: { color: 'success', text: '全款已付' },
  refunded: { color: 'default', text: '已退款' },
};

const OrderManagementPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      
      const response = await axios.get(`${API_URL}/orders`, { params });
      if (response.data.success) {
        setOrders(response.data.data);
      }
    } catch (error) {
      message.error('获取订单列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const currentPeriod = new Date().toISOString().slice(0, 7); // 2024-01
      const response = await axios.get(`${API_URL}/orders/stats/performance`, {
        params: { period: currentPeriod }
      });
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('获取统计失败', error);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const response = await axios.post(`${API_URL}/orders`, {
        ...values,
        dealerId: 'D001',
        dealerName: '恒热上海分公司',
        totalAmount: Number(values.totalAmount),
        equipmentAmount: Number(values.equipmentAmount) || 0,
        installationAmount: Number(values.installationAmount) || 0,
        finalAmount: Number(values.totalAmount),
        equipmentList: [], // 简化版本
        createdBy: 'current_user',
      });

      if (response.data.success) {
        message.success('订单创建成功！');
        setModalVisible(false);
        form.resetFields();
        fetchOrders();
        fetchStats();
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || '创建失败');
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await axios.put(`${API_URL}/orders/${id}/status`, {
        status: newStatus,
        operator: 'current_user',
        reason: '状态更新',
      });
      message.success('状态更新成功');
      fetchOrders();
      if (detailModalVisible) {
        const response = await axios.get(`${API_URL}/orders/${id}`);
        if (response.data.success) {
          setSelectedOrder(response.data.data);
        }
      }
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const handlePayment = async (id: string, type: 'deposit' | 'final') => {
    const amount = prompt(`请输入${type === 'deposit' ? '定金' : '尾款'}金额：`);
    if (amount) {
      try {
        await axios.post(`${API_URL}/orders/${id}/payment`, {
          type,
          amount: Number(amount),
          date: new Date().toISOString(),
          method: 'bank_transfer',
        });
        message.success('付款记录已添加');
        fetchOrders();
      } catch (error) {
        message.error('添加付款记录失败');
      }
    }
  };

  const showDetail = (record: any) => {
    setSelectedOrder(record);
    setDetailModalVisible(true);
  };

  const columns = [
    {
      title: '订单编号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {record.contractNo && `合同：${record.contractNo}`}
          </div>
        </div>
      ),
    },
    {
      title: '客户/项目',
      key: 'customer',
      render: (_: any, record: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.projectName}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <UserOutlined /> {record.customerName}
          </div>
        </div>
      ),
    },
    {
      title: '订单金额',
      key: 'amount',
      render: (_: any, record: any) => (
        <div>
          <div style={{ color: '#f5222d', fontWeight: 'bold', fontSize: '16px' }}>
            ¥{record.finalAmount?.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            设备：¥{record.equipmentAmount?.toLocaleString()} 
            {record.discountAmount > 0 && ` | 优惠：¥${record.discountAmount?.toLocaleString()}`}
          </div>
        </div>
      ),
    },
    {
      title: '付款状态',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      render: (status: string, record: any) => {
        const config = paymentStatusMap[status];
        const paidAmount = (record.depositAmount || 0) + (record.finalPaymentAmount || 0);
        const progress = record.finalAmount > 0 ? Math.round((paidAmount / record.finalAmount) * 100) : 0;
        
        return (
          <div style={{ width: '150px' }}>
            <Tag color={config.color}>{config.text}</Tag>
            <Progress size="small" percent={progress} showInfo={false} />
            <div style={{ fontSize: '12px', color: '#666' }}>
              已付：¥{paidAmount.toLocaleString()}
            </div>
          </div>
        );
      },
    },
    {
      title: '订单状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = orderStatusMap[status];
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '创建日期',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <Button type="primary" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)}>
            详情
          </Button>
          {record.status !== 'completed' && record.status !== 'cancelled' && (
            <>
              {record.paymentStatus === 'unpaid' && (
                <Button size="small" onClick={() => handlePayment(record.id, 'deposit')}>
                  收定金
                </Button>
              )}
              {record.paymentStatus === 'deposit_paid' && (
                <Button size="small" onClick={() => handlePayment(record.id, 'final')}>
                  收尾款
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '24px' }}>📊 成交管理系统</h2>

      {/* 业绩统计 */}
      {stats && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="本月订单数" 
                value={stats.totalOrders} 
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="本月成交额" 
                value={(stats.totalAmount / 10000).toFixed(1)} 
                suffix="万"
                valueStyle={{ color: '#f5222d' }}
                prefix={<DollarOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="已收款" 
                value={(stats.totalPaid / 10000).toFixed(1)} 
                suffix="万"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic 
                title="待收款" 
                value={(stats.totalUnpaid / 10000).toFixed(1)} 
                suffix="万"
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 订单状态分布 */}
      {stats && stats.byStatus && (
        <Card size="small" title="订单状态分布" style={{ marginBottom: '24px' }}>
          <Row gutter={[16, 16]}>
            {Object.entries(stats.byStatus).map(([status, data]: [string, any]) => (
              data.count > 0 && (
                <Col span={4} key={status}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: orderStatusMap[status]?.color }}>
                      {data.count}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {orderStatusMap[status]?.text}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      ¥{(data.amount / 10000).toFixed(1)}万
                    </div>
                  </div>
                </Col>
              )
            ))}
          </Row>
        </Card>
      )}

      {/* 订单列表 */}
      <Card 
        title="订单列表" 
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            新建订单
          </Button>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="全部订单" key="all" />
          <TabPane tab="待确认" key="pending" />
          <TabPane tab="生产中" key="production" />
          <TabPane tab="已发货" key="shipped" />
          <TabPane tab="已完成" key="completed" />
        </Tabs>

        <Table
          dataSource={orders}
          columns={columns}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 新建订单弹窗 */}
      <Modal
        title="新建订单"
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
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="客户名称"
                name="customerName"
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="联系电话" name="customerPhone" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="客户单位" name="customerCompany">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="项目地址" name="projectAddress" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="订单总额" name="totalAmount" rules={[{ required: true }]}>
                <Input type="number" prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="设备金额" name="equipmentAmount">
                <Input type="number" prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="安装费用" name="installationAmount">
                <Input type="number" prefix="¥" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="销售代表" name="salesRep">
            <Input />
          </Form.Item>

          <Form.Item label="备注" name="notes">
            <TextArea rows={3} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large">
              创建订单
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 订单详情弹窗 */}
      <Modal
        title="订单详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedOrder && (
          <div>
            {/* 订单进度 */}
            <Card size="small" title="订单进度" style={{ marginBottom: '16px' }}>
              <Steps 
                current={orderStatusMap[selectedOrder.status]?.step}
                status={selectedOrder.status === 'cancelled' ? 'error' : 'process'}
              >
                <Step title="草稿" icon={<FileTextOutlined />} />
                <Step title="待确认" icon={<SyncOutlined />} />
                <Step title="已确认" icon={<CheckCircleOutlined />} />
                <Step title="生产中" icon={<SyncOutlined spin />} />
                <Step title="已发货" icon={<CarOutlined />} />
                <Step title="已安装" icon={<ToolOutlined />} />
                <Step title="已完成" icon={<SmileOutlined />} />
              </Steps>
            </Card>

            <Row gutter={16} style={{ marginBottom: '16px' }}>
              <Col span={12}>
                <Card size="small" title="订单信息">
                  <p><strong>订单编号：</strong>{selectedOrder.orderNo}</p>
                  <p><strong>合同编号：</strong>{selectedOrder.contractNo || '-'}</p>
                  <p><strong>订单状态：</strong>
                    <Tag color={orderStatusMap[selectedOrder.status]?.color}>
                      {orderStatusMap[selectedOrder.status]?.text}
                    </Tag>
                  </p>
                  <p><strong>付款状态：</strong>
                    <Tag color={paymentStatusMap[selectedOrder.paymentStatus]?.color}>
                      {paymentStatusMap[selectedOrder.paymentStatus]?.text}
                    </Tag>
                  </p>
                  <p><strong>创建日期：</strong>{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="客户信息">
                  <p><strong>客户名称：</strong>{selectedOrder.customerName}</p>
                  <p><strong>联系电话：</strong>{selectedOrder.customerPhone}</p>
                  <p><strong>客户单位：</strong>{selectedOrder.customerCompany || '-'}</p>
                  <p><strong>销售代表：</strong>{selectedOrder.salesRep || '-'}</p>
                </Card>
              </Col>
            </Row>

            <Card size="small" title="金额明细" style={{ marginBottom: '16px' }}>
              <Row gutter={16}>
                <Col span={6}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#999' }}>订单总额</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      ¥{selectedOrder.totalAmount?.toLocaleString()}
                    </div>
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#999' }}>设备金额</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      ¥{selectedOrder.equipmentAmount?.toLocaleString()}
                    </div>
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#999' }}>安装费用</div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      ¥{selectedOrder.installationAmount?.toLocaleString()}
                    </div>
                  </div>
                </Col>
                <Col span={6}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#999' }}>最终金额</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f5222d' }}>
                      ¥{selectedOrder.finalAmount?.toLocaleString()}
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>

            {/* 状态操作 */}
            {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
              <Card size="small" title="状态操作" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedOrder.status === 'draft' && (
                    <Button onClick={() => handleStatusUpdate(selectedOrder.id, 'pending')}>
                      提交确认
                    </Button>
                  )}
                  {selectedOrder.status === 'pending' && (
                    <Button type="primary" onClick={() => handleStatusUpdate(selectedOrder.id, 'confirmed')}>
                      确认订单
                    </Button>
                  )}
                  {selectedOrder.status === 'confirmed' && (
                    <Button type="primary" onClick={() => handleStatusUpdate(selectedOrder.id, 'production')}>
                      开始生产
                    </Button>
                  )}
                  {selectedOrder.status === 'production' && (
                    <Button type="primary" onClick={() => handleStatusUpdate(selectedOrder.id, 'shipped')}>
                      标记发货
                    </Button>
                  )}
                  {selectedOrder.status === 'shipped' && (
                    <Button type="primary" onClick={() => handleStatusUpdate(selectedOrder.id, 'installed')}>
                      完成安装
                    </Button>
                  )}
                  {selectedOrder.status === 'installed' && (
                    <Button type="primary" onClick={() => handleStatusUpdate(selectedOrder.id, 'completed')}>
                      完成订单
                    </Button>
                  )}
                  <Button danger onClick={() => handleStatusUpdate(selectedOrder.id, 'cancelled')}>
                    取消订单
                  </Button>
                </div>
              </Card>
            )}

            {/* 状态历史 */}
            {selectedOrder.statusHistory?.length > 0 && (
              <Card size="small" title="状态变更历史">
                <Timeline>
                  {selectedOrder.statusHistory.map((log: any, idx: number) => (
                    <Timeline.Item key={idx}>
                      <p><strong>{orderStatusMap[log.to]?.text}</strong> - {new Date(log.date).toLocaleString()}</p>
                      <p>操作人：{log.operator}</p>
                      {log.reason && <p>原因：{log.reason}</p>}
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

export default OrderManagementPage;
