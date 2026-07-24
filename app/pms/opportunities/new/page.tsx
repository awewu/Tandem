/**
 * PMS · 新建商机
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function NewOpportunityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    dealerOrgId: 'dealer_default',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    projectName: '',
    estimatedAmount: '',
    estimatedClosingDate: '',
    productLine: '',
    region: '',
    channel: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || !formData.projectName) {
      setError('请填写客户名称和项目名称');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setDuplicateWarning(null);
      
      const res = await fetch('/api/pms/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          estimatedAmount: formData.estimatedAmount ? parseFloat(formData.estimatedAmount) : undefined,
        }),
      });
      
      const data = await res.json();
      
      // 撞单检测
      if (res.status === 409) {
        setDuplicateWarning(data.duplicateCheck);
        return;
      }
      
      if (!res.ok) {
        throw new Error(data.error || '创建失败');
      }
      
      // 成功，跳转到详情页
      router.push(`/pms/opportunities/${data.opportunity.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-3xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
        <h1 className="text-title-lg font-bold text-ink-primary">新建商机</h1>
        <p className="text-body text-ink-secondary mt-1">
          填写商机信息，系统将自动进行查重检测
        </p>
      </div>

      {duplicateWarning && (
        <Card className="mb-6 border-warning bg-warning/10">
          <CardHeader>
            <CardTitle className="flex items-center text-warning">
              <AlertTriangle className="w-5 h-5 mr-2" />
              检测到疑似撞单
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-caption text-warning mb-2">
              相似度: {(duplicateWarning.matchDetails?.[0]?.similarity * 100).toFixed(0)}%
            </p>
            <p className="text-caption text-warning mb-4">
              匹配维度: {duplicateWarning.matchDetails?.[0]?.dimensions?.join(', ')}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setDuplicateWarning(null)}
              >
                修改信息
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/pms/opportunities/${duplicateWarning.matchedOpportunities?.[0]}`)}
              >
                查看已有商机
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mb-6 border-danger bg-danger/10">
          <CardContent className="p-4">
            <p className="text-caption text-danger">{error}</p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName">客户名称 *</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="例：北京某医院"
                  required
                />
              </div>
              <div>
                <Label htmlFor="customerPhone">联系电话</Label>
                <Input
                  id="customerPhone"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  placeholder="13800138000"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="customerAddress">项目地址</Label>
              <Input
                id="customerAddress"
                value={formData.customerAddress}
                onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                placeholder="北京市朝阳区xxx路xxx号"
              />
            </div>

            <div>
              <Label htmlFor="projectName">项目名称 *</Label>
              <Input
                id="projectName"
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="例：中央空调采购项目"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estimatedAmount">预估金额（元）</Label>
                <Input
                  id="estimatedAmount"
                  type="number"
                  value={formData.estimatedAmount}
                  onChange={(e) => setFormData({ ...formData, estimatedAmount: e.target.value })}
                  placeholder="5000000"
                />
              </div>
              <div>
                <Label htmlFor="estimatedClosingDate">预计成交日期</Label>
                <Input
                  id="estimatedClosingDate"
                  type="date"
                  value={formData.estimatedClosingDate}
                  onChange={(e) => setFormData({ ...formData, estimatedClosingDate: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="productLine">产品线</Label>
                <Input
                  id="productLine"
                  value={formData.productLine}
                  onChange={(e) => setFormData({ ...formData, productLine: e.target.value })}
                  placeholder="中央空调"
                />
              </div>
              <div>
                <Label htmlFor="region">区域</Label>
                <Input
                  id="region"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="华北"
                />
              </div>
              <div>
                <Label htmlFor="channel">渠道</Label>
                <Input
                  id="channel"
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                  placeholder="直销"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-brand-500 hover:bg-brand-600"
          >
            {loading ? '创建中...' : '创建商机'}
          </Button>
        </div>
      </form>
    </div>
  );
}
