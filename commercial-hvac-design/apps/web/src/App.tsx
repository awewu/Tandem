import { Layout } from 'antd';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import ProjectCreate from './pages/ProjectCreate';
import CalculationResult from './pages/CalculationResult';
import EquipmentSelect from './pages/EquipmentSelect';
import QuotationPage from './pages/QuotationPage';
import DrawingExportPage from './pages/DrawingExportPage';
import RegistrationPage from './pages/RegistrationPage';
import OrderManagementPage from './pages/OrderManagementPage';

const { Content } = Layout;

function App() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Header />
        <Content style={{ padding: '24px', background: '#f5f5f5' }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/project/create" element={<ProjectCreate />} />
            <Route path="/calculation/result" element={<CalculationResult />} />
            <Route path="/equipment/select" element={<EquipmentSelect />} />
            <Route path="/quotation" element={<QuotationPage />} />
            <Route path="/drawings/export" element={<DrawingExportPage />} />
            <Route path="/registrations" element={<RegistrationPage />} />
            <Route path="/orders" element={<OrderManagementPage />} />
          </Routes>
        </Content>
      </Layout>
    </Router>
  );
}

export default App;
