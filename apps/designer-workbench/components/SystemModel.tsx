'use client';

import { useState } from 'react';

export type SystemType = 'freshAir' | 'heating' | 'ac' | 'water' | 'electric';

export interface Device {
  id: string;
  name: string;
  systemType: SystemType;
  productAssetRef?: string; // 指向产品真相源 catalog SKU
  bimFamilyId?: string;     // 可选 BIM 族标识
  position?: { x: number; y: number; z: number };
  params?: Record<string, number | string | boolean>;
}

export interface SystemModelData {
  devices: Device[];
}

export interface SystemModelProps {
  data?: SystemModelData;
  onChange?: (data: SystemModelData) => void;
  readonly?: boolean;
}

const SYSTEM_LABELS: Record<SystemType, string> = {
  freshAir: '新风',
  heating: '采暖',
  ac: '空调',
  water: '水电',
  electric: '强电',
};

export default function SystemModel({ data: initial = { devices: [] }, onChange, readonly }: SystemModelProps) {
  const [data, setData] = useState<SystemModelData>(initial);
  const [systemType, setSystemType] = useState<SystemType>('freshAir');
  const [deviceName, setDeviceName] = useState('');
  const [assetRef, setAssetRef] = useState('');

  const update = (next: SystemModelData) => {
    setData(next);
    onChange?.(next);
  };

  const addDevice = () => {
    if (!deviceName) return;
    const device: Device = {
      id: `d-${Date.now()}`,
      name: deviceName,
      systemType,
      productAssetRef: assetRef || undefined,
      position: { x: 0, y: 0, z: 0 },
      params: {},
    };
    update({ devices: [...data.devices, device] });
    setDeviceName('');
    setAssetRef('');
  };

  const removeDevice = (id: string) => {
    update({ devices: data.devices.filter((d) => d.id !== id) });
  };

  const bySystem = (type: SystemType) => data.devices.filter((d) => d.systemType === type);

  return (
    <div className="flex flex-col gap-2 p-2 bg-gray-50 rounded">
      <div className="text-sm font-semibold">3.4 · 分系统建模 + 族=真产品</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label>
          系统
          <select
            value={systemType}
            onChange={(e) => setSystemType(e.target.value as SystemType)}
            className="w-full border rounded px-1"
            disabled={readonly}
          >
            {Object.entries(SYSTEM_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          设备名称
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            className="w-full border rounded px-1"
            disabled={readonly}
          />
        </label>
        <label className="col-span-2">
          产品 catalog assetRef（直连计算报价）
          <input
            type="text"
            value={assetRef}
            onChange={(e) => setAssetRef(e.target.value)}
            placeholder="e.g. catalog:sku:PE25-PPR-25x3.5"
            className="w-full border rounded px-1"
            disabled={readonly}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={addDevice} className="px-2 py-1 text-sm border rounded hover:bg-gray-200" disabled={readonly}>
          添加设备
        </button>
      </div>
      <div className="text-sm">
        {Object.entries(SYSTEM_LABELS).map(([type, label]) => {
          const list = bySystem(type as SystemType);
          if (list.length === 0) return null;
          return (
            <div key={type} className="mb-2">
              <div className="font-medium">{label}</div>
              <ul className="pl-4 list-disc">
                {list.map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <span>{d.name}</span>
                    {d.productAssetRef && (
                      <span className="text-xs text-gray-500">{d.productAssetRef}</span>
                    )}
                    <button
                      onClick={() => removeDevice(d.id)}
                      className="text-xs text-red-600 hover:underline"
                      disabled={readonly}
                    >
                      删除
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="text-xs text-gray-500">
        TODO: 把 SystemModel 设备与 FloorPlanCanvas 位置绑定，并传给精算引擎作为入参。
      </div>
    </div>
  );
}
