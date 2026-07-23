import { useState } from 'react';
import { Card, Form, Input, Select, InputNumber, Button, Steps, message, Row, Col } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const { Step } = Steps;
const { Option } = Select;

const API_URL = 'http://localhost:3002/api';

const ProjectCreate = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialScene = searchParams.get('scene') || 'hotel';
  
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const buildingTypes = [
    { value: 'hotel', label: '酒店', unit: '间' },
    { value: 'hospital', label: '医院', unit: '床' },
    { value: 'school', label: '学校', unit: '人' },
    { value: 'gym', label: '健身房', unit: '人' },
    { value: 'restaurant', label: '餐厅', unit: '人' },
    { value: 'office', label: '办公楼', unit: '人' },
    { value: 'factory', label: '工厂', unit: '人' },
    { value: 'swimmingPool', label: '游泳馆', unit: '人' },
  ];

  // 获取建筑类型默认值
  const getBuildingDefaults = (type: string) => {
    const defaults: Record<string, any> = {
      hotel: { quota: 160, kh: 2.33 },
      hospital: { quota: 130, kh: 1.6 },
      school: { quota: 30, kh: 1.5 },
      gym: { quota: 40, kh: 1.5 },
      restaurant: { quota: 20, kh: 1.5 },
      office: { quota: 10, kh: 1.5 },
      factory: { quota: 40, kh: 1.5 },
      swimmingPool: { quota: 100, kh: 1.5 },
    };
    return defaults[type] || defaults.hotel;
  };

  const handleBuildingTypeChange = (value: string) => {
    const defaults = getBuildingDefaults(value);
    form.setFieldsValue({
      dailyWaterQuota: defaults.quota,
      hourlyVariationCoeff: defaults.kh,
    });
  };

  const handleCalculate = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await axios.post(`${API_URL}/calculations/hot-water`, {
        buildingType: values.buildingType,
        unitCount: values.unitCount,
        coldWaterTemp: values.coldWaterTemp,
        hotWaterTemp: values.hotWaterTemp || 60,
        hourlyVariationCoeff: values.hourlyVariationCoeff,
        dailyWaterQuota: values.dailyWaterQuota,
        buildingArea: values.buildingArea,
      });

      if (response.data.success) {
        message.success('计算完成！');
        // 存储计算结果到localStorage，供结果页面使用
        localStorage.setItem('calculationResult', JSON.stringify(response.data.data));
        navigate('/calculation/result');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '计算失败，请检查参数');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: '基础信息',
      content: (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            buildingType: initialScene,
            ...getBuildingDefaults(initialScene),
            hotWaterTemp: 60,
            coldWaterTemp: 15,
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="projectName"
                label="项目名称"
                rules={[{ required: true, message: '请输入项目名称' }]}
              >
                <Input placeholder="例如：三亚度假酒店热水系统" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="location"
                label="项目地点"
              >
                <Input placeholder="例如：海南省三亚市" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="buildingType"
                label="建筑类型"
                rules={[{ required: true }]}
              >
                <Select onChange={handleBuildingTypeChange}>
                  {buildingTypes.map(type => (
                    <Option key={type.value} value={type.value}>
                      {type.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="unitCount"
                label="数量"
                rules={[{ required: true, message: '请输入数量' }]}
              >
                <InputNumber
                  min={1}
                  style={{ width: '100%' }}
                  placeholder="房间数/床位数/人数"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="buildingArea"
                label="建筑面积 (㎡)"
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      ),
    },
    {
      title: '用水参数',
      content: (
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="dailyWaterQuota"
                label="最高日用水定额 (L/人·d)"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="hourlyVariationCoeff"
                label="小时变化系数 Kh"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="coldWaterTemp"
                label="冷水计算温度 (℃)"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} max={30} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="hotWaterTemp"
                label="热水温度 (℃)"
                rules={[{ required: true }]}
              >
                <InputNumber min={40} max={70} defaultValue={60} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Card type="inner" title="💡 参数说明" size="small" style={{ marginTop: 24 }}>
            <p><strong>小时变化系数 Kh：</strong>用水高峰时段与平均时段的比值，酒店通常取2.33~5.70</p>
            <p><strong>用水定额：</strong>每人每天的热水用量标准，依据GB 50015-2019</p>
            <p><strong>冷水温度：</strong>根据当地气候条件确定，三亚约15℃，北京约10℃</p>
          </Card>
        </Form>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Card title="新建设计项目" style={{ marginTop: 24 }}>
        <Steps current={currentStep} style={{ marginBottom: 32 }}>
          {steps.map(item => <Step key={item.title} title={item.title} />)}
        </Steps>

        <div style={{ minHeight: '300px' }}>
          {steps[currentStep].content}
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {currentStep > 0 && (
              <Button onClick={() => setCurrentStep(currentStep - 1)}>
                上一步
              </Button>
            )}
          </div>
          <div>
            {currentStep < steps.length - 1 && (
              <Button type="primary" onClick={() => setCurrentStep(currentStep + 1)}>
                下一步
              </Button>
            )}
            {currentStep === steps.length - 1 && (
              <Button 
                type="primary" 
                loading={loading}
                onClick={handleCalculate}
              >
                🚀 开始计算
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ProjectCreate;
