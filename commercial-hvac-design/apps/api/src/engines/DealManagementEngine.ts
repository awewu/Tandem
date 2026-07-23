/**
 * 成交管理引擎
 * 管理订单全流程、业绩统计、佣金计算
 */

import { v4 as uuidv4 } from 'uuid';

// 订单状态
export type OrderStatus = 
  | 'draft'           // 草稿
  | 'pending'          // 待确认
  | 'confirmed'        // 已确认
  | 'production'       // 生产中
  | 'shipped'          // 已发货
  | 'installed'        // 已安装
  | 'completed'        // 已完成
  | 'cancelled';       // 已取消

// 付款状态
export type PaymentStatus = 
  | 'unpaid'           // 未付款
  | 'deposit_paid'     // 定金已付
  | 'partial_paid'     // 部分付款
  | 'fully_paid'       // 全款已付
  | 'refunded';        // 已退款

// 订单接口
export interface Order {
  id: string;
  orderNo: string;              // 订单编号
  contractNo?: string;          // 合同编号
  
  // 关联报备
  registrationId?: string;      // 关联的报备ID
  
  // 客户信息
  customerName: string;
  customerPhone: string;
  customerCompany?: string;
  customerAddress: string;
  
  // 项目信息
  projectName: string;
  projectType: string;
  projectAddress: string;
  
  // 经销商信息
  dealerId: string;
  dealerName: string;
  salesRep: string;
  
  // 订单金额
  totalAmount: number;          // 订单总额
  equipmentAmount: number;        // 设备金额
  installationAmount: number;     // 安装金额
  discountAmount: number;        // 折扣金额
  finalAmount: number;           // 最终金额
  
  // 付款信息
  paymentStatus: PaymentStatus;
  depositAmount?: number;       // 定金金额
  depositDate?: string;          // 定金日期
  finalPaymentAmount?: number;   // 尾款金额
  finalPaymentDate?: string;    // 尾款日期
  paymentMethod?: string;        // 付款方式
  
  // 订单状态
  status: OrderStatus;
  statusHistory: StatusChange[];
  
  // 设备清单
  equipmentList: OrderEquipment[];
  
  // 安装信息
  installationInfo?: {
    plannedDate: string;
    actualDate?: string;
    installer?: string;
    completionReport?: string;
  };
  
  // 佣金信息
  commission?: {
    rate: number;                // 佣金比例
    amount: number;            // 佣金金额
    status: 'pending' | 'paid' | 'cancelled';
    paymentDate?: string;
  };
  
  // 备注
  notes?: string;
  
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// 订单设备
export interface OrderEquipment {
  id: string;
  name: string;
  model: string;
  brand: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  deliveryDate?: string;
}

// 状态变更记录
export interface StatusChange {
  from: OrderStatus;
  to: OrderStatus;
  date: string;
  operator: string;
  reason?: string;
}

// 业绩统计接口
export interface PerformanceStats {
  period: string;
  dealerId?: string;
  
  // 订单统计
  totalOrders: number;
  totalAmount: number;
  averageOrderValue: number;
  
  // 状态分布
  byStatus: Record<OrderStatus, { count: number; amount: number }>;
  
  // 付款统计
  totalPaid: number;
  totalUnpaid: number;
  
  // 佣金统计
  totalCommission: number;
  paidCommission: number;
  pendingCommission: number;
  
  // 环比数据
  comparison?: {
    ordersChange: number;      // 订单数变化率
    amountChange: number;      // 金额变化率
  };
}

export class DealManagementEngine {
  private orders: Map<string, Order> = new Map();
  private orderCounter: number = 1000;
  
  /**
   * 生成订单编号
   */
  private generateOrderNo(): string {
    const date = new Date();
    const prefix = 'HT' + date.getFullYear().toString().slice(-2) + 
                   String(date.getMonth() + 1).padStart(2, '0');
    this.orderCounter++;
    return `${prefix}-${String(this.orderCounter).padStart(5, '0')}`;
  }
  
  /**
   * 创建订单（从报备转换）
   */
  createOrderFromRegistration(
    registration: {
      id: string;
      projectName: string;
      customerName: string;
      customerPhone: string;
      customerCompany?: string;
      projectAddress: string;
      projectType: string;
      dealerId: string;
      dealerName: string;
      salesRep: string;
      estimatedAmount: number;
    },
    orderData: {
      equipmentList: OrderEquipment[];
      installationAmount?: number;
      discountAmount?: number;
      notes?: string;
    },
    createdBy: string
  ): { success: boolean; order?: Order; error?: string } {
    // 计算金额
    const equipmentAmount = orderData.equipmentList.reduce((sum, e) => sum + e.totalPrice, 0);
    const installationAmount = orderData.installationAmount || 0;
    const discountAmount = orderData.discountAmount || 0;
    const finalAmount = equipmentAmount + installationAmount - discountAmount;
    
    const order: Order = {
      id: uuidv4(),
      orderNo: this.generateOrderNo(),
      registrationId: registration.id,
      
      customerName: registration.customerName,
      customerPhone: registration.customerPhone,
      customerCompany: registration.customerCompany,
      customerAddress: registration.projectAddress,
      
      projectName: registration.projectName,
      projectType: registration.projectType,
      projectAddress: registration.projectAddress,
      
      dealerId: registration.dealerId,
      dealerName: registration.dealerName,
      salesRep: registration.salesRep,
      
      totalAmount: finalAmount,
      equipmentAmount,
      installationAmount,
      discountAmount,
      finalAmount,
      
      paymentStatus: 'unpaid',
      status: 'draft',
      statusHistory: [{
        from: 'draft',
        to: 'draft',
        date: new Date().toISOString(),
        operator: createdBy,
        reason: '订单创建',
      }],
      
      equipmentList: orderData.equipmentList,
      notes: orderData.notes,
      
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy,
    };
    
    this.orders.set(order.id, order);
    
    return { success: true, order };
  }
  
  /**
   * 创建新订单
   */
  createOrder(
    orderData: Omit<Order, 'id' | 'orderNo' | 'createdAt' | 'updatedAt' | 'statusHistory'>,
    createdBy: string
  ): { success: boolean; order?: Order; error?: string } {
    const order: Order = {
      ...orderData,
      id: uuidv4(),
      orderNo: this.generateOrderNo(),
      status: 'draft',
      statusHistory: [{
        from: 'draft',
        to: 'draft',
        date: new Date().toISOString(),
        operator: createdBy,
        reason: '订单创建',
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy,
    };
    
    this.orders.set(order.id, order);
    
    return { success: true, order };
  }
  
  /**
   * 获取订单列表
   */
  getOrders(
    filters?: {
      dealerId?: string;
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      startDate?: string;
      endDate?: string;
    }
  ): Order[] {
    let results = Array.from(this.orders.values());
    
    if (filters?.dealerId) {
      results = results.filter(o => o.dealerId === filters.dealerId);
    }
    
    if (filters?.status) {
      results = results.filter(o => o.status === filters.status);
    }
    
    if (filters?.paymentStatus) {
      results = results.filter(o => o.paymentStatus === filters.paymentStatus);
    }
    
    if (filters?.startDate) {
      results = results.filter(o => o.createdAt >= filters.startDate!);
    }
    
    if (filters?.endDate) {
      results = results.filter(o => o.createdAt <= filters.endDate!);
    }
    
    return results.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  
  /**
   * 获取订单详情
   */
  getOrder(id: string): Order | null {
    return this.orders.get(id) || null;
  }
  
  /**
   * 更新订单状态
   */
  updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    operator: string,
    reason?: string
  ): { success: boolean; error?: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: '订单不存在' };
    }
    
    const oldStatus = order.status;
    
    order.status = newStatus;
    order.statusHistory.push({
      from: oldStatus,
      to: newStatus,
      date: new Date().toISOString(),
      operator,
      reason,
    });
    order.updatedAt = new Date().toISOString();
    
    return { success: true };
  }
  
  /**
   * 记录付款
   */
  recordPayment(
    orderId: string,
    payment: {
      type: 'deposit' | 'final' | 'full';
      amount: number;
      date: string;
      method: string;
    }
  ): { success: boolean; error?: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: '订单不存在' };
    }
    
    if (payment.type === 'deposit') {
      order.depositAmount = payment.amount;
      order.depositDate = payment.date;
      order.paymentStatus = 'deposit_paid';
    } else if (payment.type === 'final') {
      order.finalPaymentAmount = payment.amount;
      order.finalPaymentDate = payment.date;
      order.paymentStatus = 'fully_paid';
    } else if (payment.type === 'full') {
      order.depositAmount = payment.amount;
      order.depositDate = payment.date;
      order.paymentStatus = 'fully_paid';
    }
    
    order.paymentMethod = payment.method;
    order.updatedAt = new Date().toISOString();
    
    return { success: true };
  }
  
  /**
   * 设置安装信息
   */
  setInstallationInfo(
    orderId: string,
    info: {
      plannedDate: string;
      actualDate?: string;
      installer?: string;
      completionReport?: string;
    }
  ): { success: boolean; error?: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: '订单不存在' };
    }
    
    order.installationInfo = info;
    order.updatedAt = new Date().toISOString();
    
    // 如果有实际安装日期，自动更新状态为已安装
    if (info.actualDate) {
      this.updateStatus(orderId, 'installed', 'system', '安装完成');
    }
    
    return { success: true };
  }
  
  /**
   * 计算佣金
   */
  calculateCommission(
    orderId: string,
    rate: number          // 佣金比例，如 0.05 = 5%
  ): { success: boolean; commission?: number; error?: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: '订单不存在' };
    }
    
    // 佣金基于设备金额计算（不含安装费）
    const commissionAmount = Math.round(order.equipmentAmount * rate);
    
    order.commission = {
      rate,
      amount: commissionAmount,
      status: 'pending',
    };
    order.updatedAt = new Date().toISOString();
    
    return { success: true, commission: commissionAmount };
  }
  
  /**
   * 支付佣金
   */
  payCommission(
    orderId: string,
    paymentDate: string
  ): { success: boolean; error?: string } {
    const order = this.orders.get(orderId);
    if (!order) {
      return { success: false, error: '订单不存在' };
    }
    
    if (!order.commission) {
      return { success: false, error: '未设置佣金' };
    }
    
    order.commission.status = 'paid';
    order.commission.paymentDate = paymentDate;
    order.updatedAt = new Date().toISOString();
    
    return { success: true };
  }
  
  /**
   * 获取业绩统计
   */
  getPerformanceStats(
    period: string,       // 如 '2024-01' 或 '2024-Q1'
    dealerId?: string
  ): PerformanceStats {
    // 解析时间段
    const [year, monthOrQuarter] = period.split('-');
    let startDate: Date;
    let endDate: Date;
    
    if (monthOrQuarter.startsWith('Q')) {
      // 季度统计
      const quarter = parseInt(monthOrQuarter.slice(1));
      startDate = new Date(parseInt(year), (quarter - 1) * 3, 1);
      endDate = new Date(parseInt(year), quarter * 3, 0);
    } else {
      // 月度统计
      startDate = new Date(parseInt(year), parseInt(monthOrQuarter) - 1, 1);
      endDate = new Date(parseInt(year), parseInt(monthOrQuarter), 0);
    }
    
    // 筛选订单
    let orders = Array.from(this.orders.values()).filter(o => {
      const orderDate = new Date(o.createdAt);
      return orderDate >= startDate && orderDate <= endDate;
    });
    
    if (dealerId) {
      orders = orders.filter(o => o.dealerId === dealerId);
    }
    
    // 统计计算
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, o) => sum + o.finalAmount, 0);
    const averageOrderValue = totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0;
    
    // 状态分布
    const byStatus: Record<OrderStatus, { count: number; amount: number }> = {
      draft: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      confirmed: { count: 0, amount: 0 },
      production: { count: 0, amount: 0 },
      shipped: { count: 0, amount: 0 },
      installed: { count: 0, amount: 0 },
      completed: { count: 0, amount: 0 },
      cancelled: { count: 0, amount: 0 },
    };
    
    orders.forEach(o => {
      byStatus[o.status].count++;
      byStatus[o.status].amount += o.finalAmount;
    });
    
    // 付款统计
    const totalPaid = orders
      .filter(o => o.paymentStatus === 'fully_paid' || o.paymentStatus === 'deposit_paid')
      .reduce((sum, o) => sum + (o.depositAmount || 0) + (o.finalPaymentAmount || 0), 0);
    
    const totalUnpaid = totalAmount - totalPaid;
    
    // 佣金统计
    const ordersWithCommission = orders.filter(o => o.commission);
    const totalCommission = ordersWithCommission.reduce((sum, o) => sum + (o.commission?.amount || 0), 0);
    const paidCommission = ordersWithCommission
      .filter(o => o.commission?.status === 'paid')
      .reduce((sum, o) => sum + (o.commission?.amount || 0), 0);
    const pendingCommission = totalCommission - paidCommission;
    
    return {
      period,
      dealerId,
      totalOrders,
      totalAmount,
      averageOrderValue,
      byStatus,
      totalPaid,
      totalUnpaid,
      totalCommission,
      paidCommission,
      pendingCommission,
    };
  }
  
  /**
   * 获取经销商排名
   */
  getDealerRanking(
    period: string,
    limit: number = 10
  ): Array<{
    dealerId: string;
    dealerName: string;
    orderCount: number;
    totalAmount: number;
    conversionRate: number;
  }> {
    const stats = this.getPerformanceStats(period);
    
    // 按经销商分组统计
    const dealerStats = new Map<string, {
      dealerId: string;
      dealerName: string;
      orderCount: number;
      totalAmount: number;
    }>();
    
    const orders = this.getOrders().filter(o => {
      const orderDate = new Date(o.createdAt);
      const [year, monthOrQuarter] = period.split('-');
      
      if (monthOrQuarter.startsWith('Q')) {
        const quarter = parseInt(monthOrQuarter.slice(1));
        const startDate = new Date(parseInt(year), (quarter - 1) * 3, 1);
        const endDate = new Date(parseInt(year), quarter * 3, 0);
        return orderDate >= startDate && orderDate <= endDate;
      } else {
        const startDate = new Date(parseInt(year), parseInt(monthOrQuarter) - 1, 1);
        const endDate = new Date(parseInt(year), parseInt(monthOrQuarter), 0);
        return orderDate >= startDate && orderDate <= endDate;
      }
    });
    
    orders.forEach(o => {
      const stat = dealerStats.get(o.dealerId) || {
        dealerId: o.dealerId,
        dealerName: o.dealerName,
        orderCount: 0,
        totalAmount: 0,
      };
      
      stat.orderCount++;
      stat.totalAmount += o.finalAmount;
      
      dealerStats.set(o.dealerId, stat);
    });
    
    return Array.from(dealerStats.values())
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, limit)
      .map(d => ({
        ...d,
        conversionRate: 0, // 需要结合报备数据计算
      }));
  }
}

// 导出单例
export const dealManagementEngine = new DealManagementEngine();
