'use client';

import { useMemo } from 'react';
import { Device } from './SystemModel';
import { PipeSegment } from './HvacParametricLayer';

export interface BomItem {
  id: string;
  category: string;
  name: string;
  spec: string;
  quantity: number;
  unit: string;
  assetRef?: string;
  unitPrice?: number;
  totalPrice?: number;
}

export interface BomSheetProps {
  devices: Device[];
  pipes: PipeSegment[];
}

export default function BomSheet({ devices, pipes }: BomSheetProps) {
  const items = useMemo<BomItem[]>(() => {
    const list: BomItem[] = [];

    // 设备项
    devices.forEach((d) => {
      const quantity = positive(d.params?.quantity, 1);
      const unit = textValue(d.params?.unit, '台');
      const bomCategory = textValue(d.params?.bomCategory, '设备');
      const bomSkuHint = textValue(d.params?.bomSkuHint, '');
      list.push({
        id: d.id,
        category: bomCategory,
        name: d.name,
        spec: bomSkuHint || d.bimFamilyId || '标准族',
        quantity,
        unit,
        assetRef: d.productAssetRef ?? bomSkuHint,
      });
    });

    // 管段按材质/直径聚合
    const pipeGroups = new Map<string, { material: string; diameter: number; insulation: number; lengthM: number }>();
    pipes.forEach((p) => {
      const key = `${p.material}-${p.diameterMm}-${p.insulationThicknessMm}`;
      const segLenMm = pipeLengthMm(p);
      const existing = pipeGroups.get(key);
      if (existing) {
        existing.lengthM += segLenMm / 1000;
      } else {
        pipeGroups.set(key, {
          material: p.material,
          diameter: p.diameterMm,
          insulation: p.insulationThicknessMm,
          lengthM: segLenMm / 1000,
        });
      }
    });

    let idx = 0;
    pipeGroups.forEach((g) => {
      list.push({
        id: `pipe-${idx++}`,
        category: '管材',
        name: `${g.material} 管`,
        spec: `DN${g.diameter} × 保温 ${g.insulation}mm`,
        quantity: Number(g.lengthM.toFixed(2)),
        unit: 'm',
      });
    });

    // 吊杆：按管段数量估算
    pipes.forEach((p, i) => {
      if (!p.hasHanger || p.hangerSpacingMm <= 0) return;
      const segLenMm = pipeLengthMm(p);
      const count = Math.max(1, Math.ceil(segLenMm / p.hangerSpacingMm));
      list.push({
        id: `hanger-${i}`,
        category: '辅材',
        name: '吊杆',
        spec: `间距 ${p.hangerSpacingMm}mm`,
        quantity: count,
        unit: '套',
      });
    });

    return list;
  }, [devices, pipes]);

  return (
    <div className="flex flex-col gap-2 p-2 bg-gray-50 rounded">
      <div className="text-sm font-semibold">3.5 · 材料清单（BOM）</div>
      <table className="text-sm w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-1 text-left">类别</th>
            <th className="border px-2 py-1 text-left">名称</th>
            <th className="border px-2 py-1 text-left">规格</th>
            <th className="border px-2 py-1 text-left">数量</th>
            <th className="border px-2 py-1 text-left">单位</th>
            <th className="border px-2 py-1 text-left">产品编码</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="border px-2 py-1">{item.category}</td>
              <td className="border px-2 py-1">{item.name}</td>
              <td className="border px-2 py-1">{item.spec}</td>
              <td className="border px-2 py-1">{item.quantity}</td>
              <td className="border px-2 py-1">{item.unit}</td>
              <td className="border px-2 py-1 text-xs text-gray-600">{item.assetRef ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs text-gray-500">
        TODO: 对接产品目录价格接口，自动填充 unitPrice / totalPrice，生成 PDF 报价单。
      </div>
    </div>
  );
}

function positive(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function textValue(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function pipeLengthMm(pipe: PipeSegment): number {
  const acceptedLengthM = Number((pipe as PipeSegment & { acceptedLengthM?: number }).acceptedLengthM);
  if (Number.isFinite(acceptedLengthM) && acceptedLengthM > 0) return acceptedLengthM * 1000;
  return Math.sqrt(
    Math.pow(pipe.end.x - pipe.start.x, 2) +
      Math.pow(pipe.end.y - pipe.start.y, 2) +
      Math.pow(pipe.end.z - pipe.start.z, 2)
  );
}
