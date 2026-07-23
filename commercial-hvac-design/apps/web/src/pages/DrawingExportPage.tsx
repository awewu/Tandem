import { useState } from 'react';
import { Card, Button, Row, Col, Tabs, Table, message, Input, Descriptions } from 'antd';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  FileImageOutlined, 
  FileTextOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { TabPane } = Tabs;
const { TextArea } = Input;

const API_URL = 'http://localhost:3002/api';

const DrawingExportPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [exportResult, setExportResult] = useState<any>(null);
  const [projectName, setProjectName] = useState('三亚度假酒店热水系统');

  const handleExport = async () => {
    try {
      setLoading(true);
      
      // 获取计算结果
      const calcResult = localStorage.getItem('calculationResult');
      if (!calcResult) {
        message.warning('请先完成负荷计算');
        return;
      }
      
      const calculation = JSON.parse(calcResult);
      
      const response = await axios.post(`${API_URL}/drawings/export`, {
        projectName,
        buildingType: 'hotel',
        buildingArea: 15000,
        unitCount: calculation.parameters['m (计算单位数)'] || 200,
        equipmentList: [
          {
            name: '空气源热泵',
            model: 'KFXRS-38II',
            power: 38,
            quantity: Math.ceil(calculation.equipmentPower / 38),
          },
        ],
        tankList: [
          {
            volume: calculation.storageTankVolume,
            quantity: 1,
          },
        ],
        pipeRouting: {
          mainPipeDN: 32,
          branchPipeDN: 25,
          circulationPipeDN: 20,
          estimatedLength: 300,
        },
        drawingType: 'all',
      });

      if (response.data.success) {
        setExportResult(response.data.data);
        message.success('图纸和材料清单生成成功！');
      }
    } catch (error) {
      message.error('导出失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSVG = (svgContent: string, filename: string) => {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMaterialBill = () => {
    if (!exportResult?.materialBill) return;
    
    const bill = exportResult.materialBill;
    let csv = `材料清单 - ${bill.projectName}\n`;
    csv += `导出日期: ${bill.exportDate}\n\n`;
    csv += '序号,分类,编号,名称,型号,品牌,单位,数量,单重(kg),总重(kg),备注\n';
    
    let index = 1;
    bill.categories.forEach((category: any) => {
      category.items.forEach((item: any) => {
        csv += `${index},${category.name},${item.no},${item.name},${item.model},${item.brand},${item.unit},${item.quantity},${item.unitWeight || ''},${item.totalWeight || ''},${item.remark || ''}\n`;
        index++;
      });
    });
    
    csv += `\n汇总,,,,,,,,,${bill.summary.totalWeight}kg,共${bill.summary.totalItems}项\n`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `材料清单-${bill.projectName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '24px' }}>🏗️ 设计院施工图导出</h2>

      {!exportResult ? (
        <Card title="生成施工图纸和材料清单" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              项目名称
            </label>
            <Input 
              value={projectName} 
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="请输入项目名称"
              size="large"
            />
          </div>

          <div style={{ background: '#f6ffed', padding: '16px', borderRadius: '4px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span style={{ fontWeight: 'bold' }}>将生成以下交付物：</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '24px', color: '#666' }}>
              <li>系统原理图 (SVG格式)</li>
              <li>设备平面布置图 (SVG格式)</li>
              <li>完整材料清单 (CSV格式)</li>
              <li>技术规格书 (GB 50015-2019标准)</li>
            </ul>
          </div>

          <Button 
            type="primary" 
            size="large" 
            block 
            loading={loading}
            onClick={handleExport}
            icon={<FileImageOutlined />}
          >
            生成施工图纸和材料清单
          </Button>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Button type="link" onClick={() => navigate('/quotation')}>
              <ArrowLeftOutlined /> 返回报价系统
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Card 
            title={`📋 ${exportResult.materialBill.projectName} - 设计交付物`}
            extra={
              <Button 
                type="primary" 
                icon={<DownloadOutlined />}
                onClick={handleDownloadMaterialBill}
              >
                下载材料清单(CSV)
              </Button>
            }
            style={{ marginBottom: '24px' }}
          >
            <Tabs defaultActiveKey="1">
              {/* 图纸预览 */}
              <TabPane tab="📐 施工图纸" key="1">
                <Row gutter={[16, 16]}>
                  {exportResult.drawings.map((drawing: any, index: number) => (
                    <Col span={12} key={index}>
                      <Card 
                        type="inner" 
                        title={drawing.name}
                        extra={
                          <Button 
                            size="small" 
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownloadSVG(drawing.content, `${drawing.name}.svg`)}
                          >
                            下载SVG
                          </Button>
                        }
                      >
                        <div 
                          style={{ 
                            border: '1px solid #e8e8e8', 
                            borderRadius: '4px',
                            overflow: 'hidden',
                            background: '#f9f9f9',
                          }}
                          dangerouslySetInnerHTML={{ __html: drawing.content }}
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>
              </TabPane>

              {/* 材料清单 */}
              <TabPane tab="📦 材料清单" key="2">
                {exportResult.materialBill.categories.map((category: any, catIndex: number) => (
                  <Card 
                    key={catIndex} 
                    type="inner" 
                    title={category.name}
                    style={{ marginBottom: '16px' }}
                    size="small"
                  >
                    <Table
                      dataSource={category.items}
                      pagination={false}
                      size="small"
                      columns={[
                        { title: '编号', dataIndex: 'no', key: 'no', width: 80 },
                        { title: '名称', dataIndex: 'name', key: 'name' },
                        { title: '型号', dataIndex: 'model', key: 'model' },
                        { title: '品牌', dataIndex: 'brand', key: 'brand', width: 100 },
                        { title: '单位', dataIndex: 'unit', key: 'unit', width: 60 },
                        { title: '数量', dataIndex: 'quantity', key: 'quantity', width: 60 },
                        { title: '单重(kg)', dataIndex: 'unitWeight', key: 'unitWeight', width: 80, render: (v: number) => v || '-' },
                        { title: '总重(kg)', dataIndex: 'totalWeight', key: 'totalWeight', width: 80, render: (v: number) => v || '-' },
                        { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
                      ]}
                    />
                  </Card>
                ))}

                <Descriptions bordered size="small" style={{ marginTop: '16px' }}>
                  <Descriptions.Item label="总项数">{exportResult.materialBill.summary.totalItems} 项</Descriptions.Item>
                  <Descriptions.Item label="总重量">{exportResult.materialBill.summary.totalWeight} kg</Descriptions.Item>
                </Descriptions>
              </TabPane>

              {/* 技术规格书 */}
              <TabPane tab="📄 技术规格书" key="3">
                <Card type="inner">
                  <TextArea
                    value={exportResult.specifications.join('\n')}
                    rows={30}
                    readOnly
                    style={{ fontFamily: 'monospace', fontSize: '14px' }}
                  />
                  <Button 
                    style={{ marginTop: '16px' }}
                    icon={<DownloadOutlined />}
                    onClick={() => {
                      const blob = new Blob([exportResult.specifications.join('\n')], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `技术规格书-${exportResult.materialBill.projectName}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    下载规格书
                  </Button>
                </Card>
              </TabPane>
            </Tabs>
          </Card>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button size="large" onClick={() => setExportResult(null)}>
              ← 重新生成
            </Button>
            <Button 
              type="primary" 
              size="large"
              onClick={() => message.success('设计方案已归档！完整项目流程开发中...')}
            >
              完成设计 →
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default DrawingExportPage;
