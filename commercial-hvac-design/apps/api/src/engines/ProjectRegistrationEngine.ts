/**
 * 项目报备引擎
 * 管理经销商项目报备、保护期、冲突检测
 */

import { v4 as uuidv4 } from 'uuid';

// 项目报备状态
export type RegistrationStatus = 
  | 'pending'     // 待审核
  | 'approved'    // 已批准（保护期内）
  | 'rejected'    // 已拒绝
  | 'expired'     // 已过期
  | 'converted'   // 已成交
  | 'lost';       // 已丢单

// 报备项目接口
export interface ProjectRegistration {
  id: string;
  projectName: string;
  customerName: string;
  customerPhone: string;
  customerCompany?: string;
  projectAddress: string;
  projectType: string;        // 酒店/医院/学校等
  estimatedAmount: number;    // 预估金额
  estimatedUnits: number;   // 预估数量（客房/床位等）
  
  // 报备信息
  dealerId: string;           // 报备经销商ID
  dealerName: string;         // 经销商名称
  salesRep: string;          // 销售代表
  registrationDate: string;   // 报备日期
  protectionExpiry: string;   // 保护期到期日
  
  // 状态管理
  status: RegistrationStatus;
  approvalDate?: string;      // 批准日期
  rejectionReason?: string;   // 拒绝原因
  
  // 跟进记录
  followUpLogs: FollowUpLog[];
  
  // 竞争信息
  competitorInfo?: {
    competitors: string[];      // 竞争对手
    competitorPrice?: number;   // 竞争对手报价
    ourAdvantage?: string;    // 我方优势
  };
  
  createdAt: string;
  updatedAt: string;
}

// 跟进记录
export interface FollowUpLog {
  id: string;
  date: string;
  type: 'visit' | 'phone' | 'email' | 'quote' | 'demo' | 'negotiation' | 'other';
  content: string;
  result?: string;
  nextAction?: string;
  nextDate?: string;
  createdBy: string;
}

// 报备规则配置
const REGISTRATION_RULES = {
  protectionDays: 30,           // 保护期30天
  extensionDays: 15,            // 可延期15天
  maxExtensions: 2,             // 最多延期2次
  minProjectAmount: 50000,     // 最低报备金额5万
  duplicateCheckDays: 90,       // 90天内重复报备检测
};

export class ProjectRegistrationEngine {
  private registrations: Map<string, ProjectRegistration> = new Map();
  
  /**
   * 提交项目报备
   */
  submitRegistration(
    dealerId: string,
    dealerName: string,
    projectData: {
      projectName: string;
      customerName: string;
      customerPhone: string;
      customerCompany?: string;
      projectAddress: string;
      projectType: string;
      estimatedAmount: number;
      estimatedUnits: number;
      salesRep: string;
    }
  ): { success: boolean; registration?: ProjectRegistration; error?: string } {
    // 1. 检查最低金额
    if (projectData.estimatedAmount < REGISTRATION_RULES.minProjectAmount) {
      return {
        success: false,
        error: `项目金额低于最低报备标准 ¥${REGISTRATION_RULES.minProjectAmount}`,
      };
    }
    
    // 2. 检查重复报备（手机号或客户名称在90天内已报备）
    const duplicate = this.checkDuplicate(projectData.customerPhone, projectData.customerName);
    if (duplicate) {
      return {
        success: false,
        error: `该项目已被 ${duplicate.dealerName} 于 ${duplicate.registrationDate} 报备，保护期至 ${duplicate.protectionExpiry}`,
      };
    }
    
    // 3. 创建报备记录
    const now = new Date();
    const protectionExpiry = new Date();
    protectionExpiry.setDate(now.getDate() + REGISTRATION_RULES.protectionDays);
    
    const registration: ProjectRegistration = {
      id: uuidv4(),
      ...projectData,
      dealerId,
      dealerName,
      registrationDate: now.toISOString(),
      protectionExpiry: protectionExpiry.toISOString(),
      status: 'approved', // 自动批准，简化流程
      approvalDate: now.toISOString(),
      followUpLogs: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    
    this.registrations.set(registration.id, registration);
    
    return {
      success: true,
      registration,
    };
  }
  
  /**
   * 检查重复报备
   */
  private checkDuplicate(phone: string, customerName: string): ProjectRegistration | null {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - REGISTRATION_RULES.duplicateCheckDays);
    
    for (const reg of this.registrations.values()) {
      // 检查是否处于保护期内
      if (new Date(reg.protectionExpiry) < new Date()) {
        continue;
      }
      
      // 检查手机号或客户名称匹配
      if (reg.customerPhone === phone || reg.customerName === customerName) {
        return reg;
      }
    }
    
    return null;
  }
  
  /**
   * 获取报备列表
   */
  getRegistrations(
    dealerId?: string,
    status?: RegistrationStatus
  ): ProjectRegistration[] {
    let results = Array.from(this.registrations.values());
    
    if (dealerId) {
      results = results.filter(r => r.dealerId === dealerId);
    }
    
    if (status) {
      results = results.filter(r => r.status === status);
    }
    
    // 按时间倒序
    return results.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  
  /**
   * 获取报备详情
   */
  getRegistration(id: string): ProjectRegistration | null {
    return this.registrations.get(id) || null;
  }
  
  /**
   * 添加跟进记录
   */
  addFollowUpLog(
    registrationId: string,
    log: Omit<FollowUpLog, 'id' | 'date'>
  ): { success: boolean; error?: string } {
    const registration = this.registrations.get(registrationId);
    if (!registration) {
      return { success: false, error: '报备项目不存在' };
    }
    
    const followUpLog: FollowUpLog = {
      id: uuidv4(),
      date: new Date().toISOString(),
      ...log,
    };
    
    registration.followUpLogs.push(followUpLog);
    registration.updatedAt = new Date().toISOString();
    
    return { success: true };
  }
  
  /**
   * 更新竞争信息
   */
  updateCompetitorInfo(
    registrationId: string,
    competitorInfo: ProjectRegistration['competitorInfo']
  ): { success: boolean; error?: string } {
    const registration = this.registrations.get(registrationId);
    if (!registration) {
      return { success: false, error: '报备项目不存在' };
    }
    
    registration.competitorInfo = competitorInfo;
    registration.updatedAt = new Date().toISOString();
    
    return { success: true };
  }
  
  /**
   * 延期保护期
   */
  extendProtection(
    registrationId: string,
    reason: string
  ): { success: boolean; newExpiry?: string; error?: string } {
    const registration = this.registrations.get(registrationId);
    if (!registration) {
      return { success: false, error: '报备项目不存在' };
    }
    
    // 计算已延期次数
    const currentExpiry = new Date(registration.protectionExpiry);
    const originalExpiry = new Date(registration.registrationDate);
    originalExpiry.setDate(originalExpiry.getDate() + REGISTRATION_RULES.protectionDays);
    
    const extensionsCount = Math.floor(
      (currentExpiry.getTime() - originalExpiry.getTime()) / (REGISTRATION_RULES.extensionDays * 24 * 60 * 60 * 1000)
    );
    
    if (extensionsCount >= REGISTRATION_RULES.maxExtensions) {
      return { success: false, error: '已超过最大延期次数' };
    }
    
    // 延期
    const newExpiry = new Date(registration.protectionExpiry);
    newExpiry.setDate(newExpiry.getDate() + REGISTRATION_RULES.extensionDays);
    
    registration.protectionExpiry = newExpiry.toISOString();
    registration.updatedAt = new Date().toISOString();
    
    // 添加跟进记录
    this.addFollowUpLog(registrationId, {
      type: 'other',
      content: `申请保护期延期：${reason}`,
      result: '批准',
      createdBy: registration.dealerId,
    });
    
    return {
      success: true,
      newExpiry: newExpiry.toISOString(),
    };
  }
  
  /**
   * 标记为已成交
   */
  markAsConverted(
    registrationId: string,
    orderData: {
      orderAmount: number;
      orderDate: string;
      contractNo?: string;
    }
  ): { success: boolean; error?: string } {
    const registration = this.registrations.get(registrationId);
    if (!registration) {
      return { success: false, error: '报备项目不存在' };
    }
    
    registration.status = 'converted';
    registration.updatedAt = new Date().toISOString();
    
    // 添加成交跟进记录
    this.addFollowUpLog(registrationId, {
      type: 'other',
      content: `项目成交！合同金额：¥${orderData.orderAmount.toLocaleString()}`,
      result: `合同号：${orderData.contractNo || '待定'}`,
      createdBy: registration.dealerId,
    });
    
    return { success: true };
  }
  
  /**
   * 标记为已丢单
   */
  markAsLost(
    registrationId: string,
    reason: string
  ): { success: boolean; error?: string } {
    const registration = this.registrations.get(registrationId);
    if (!registration) {
      return { success: false, error: '报备项目不存在' };
    }
    
    registration.status = 'lost';
    registration.updatedAt = new Date().toISOString();
    
    // 添加丢单跟进记录
    this.addFollowUpLog(registrationId, {
      type: 'other',
      content: `项目丢单，原因：${reason}`,
      createdBy: registration.dealerId,
    });
    
    return { success: true };
  }
  
  /**
   * 获取报备统计数据
   */
  getRegistrationStats(dealerId?: string): {
    total: number;
    pending: number;
    approved: number;
    converted: number;
    lost: number;
    expired: number;
    conversionRate: number;
    totalAmount: number;
    convertedAmount: number;
  } {
    const regs = dealerId 
      ? Array.from(this.registrations.values()).filter(r => r.dealerId === dealerId)
      : Array.from(this.registrations.values());
    
    const total = regs.length;
    const pending = regs.filter(r => r.status === 'pending').length;
    const approved = regs.filter(r => r.status === 'approved').length;
    const converted = regs.filter(r => r.status === 'converted').length;
    const lost = regs.filter(r => r.status === 'lost').length;
    const expired = regs.filter(r => r.status === 'expired').length;
    
    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    
    const totalAmount = regs.reduce((sum, r) => sum + r.estimatedAmount, 0);
    const convertedAmount = regs
      .filter(r => r.status === 'converted')
      .reduce((sum, r) => sum + r.estimatedAmount, 0);
    
    return {
      total,
      pending,
      approved,
      converted,
      lost,
      expired,
      conversionRate,
      totalAmount,
      convertedAmount,
    };
  }
  
  /**
   * 获取即将过期的报备
   */
  getExpiringRegistrations(days: number = 7): ProjectRegistration[] {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);
    
    return Array.from(this.registrations.values())
      .filter(r => {
        if (r.status !== 'approved') return false;
        const expiry = new Date(r.protectionExpiry);
        return expiry <= threshold && expiry > new Date();
      })
      .sort((a, b) => 
        new Date(a.protectionExpiry).getTime() - new Date(b.protectionExpiry).getTime()
      );
  }
}

// 导出单例
export const registrationEngine = new ProjectRegistrationEngine();
