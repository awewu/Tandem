import { Layout, Menu, Button } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { PlusOutlined, HomeOutlined, DollarOutlined, FileImageOutlined, FormOutlined, ShoppingCartOutlined } from '@ant-design/icons';

const { Header: AntHeader } = Layout;

const Header = () => {
  const location = useLocation();
  
  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: <Link to="/">首页</Link>,
    },
    {
      key: '/project/create',
      icon: <PlusOutlined />,
      label: <Link to="/project/create">新建项目</Link>,
    },
    {
      key: '/quotation',
      icon: <DollarOutlined />,
      label: <Link to="/quotation">经销商报价</Link>,
    },
    {
      key: '/drawings/export',
      icon: <FileImageOutlined />,
      label: <Link to="/drawings/export">设计院出图</Link>,
    },
    {
      key: '/registrations',
      icon: <FormOutlined />,
      label: <Link to="/registrations">项目报备</Link>,
    },
    {
      key: '/orders',
      icon: <ShoppingCartOutlined />,
      label: <Link to="/orders">成交管理</Link>,
    },
  ];

  return (
    <AntHeader style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      background: '#fff',
      borderBottom: '1px solid #e8e8e8',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
    }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ 
          fontSize: '20px', 
          fontWeight: 'bold', 
          marginRight: '48px',
          color: '#1a5fb4',
        }}>
          🔥 恒热商用暖通AI设计平台
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ border: 'none', minWidth: '400px' }}
        />
      </div>
      <div>
        <Button type="primary" icon={<PlusOutlined />}>
          快速计算
        </Button>
      </div>
    </AntHeader>
  );
};

export default Header;
