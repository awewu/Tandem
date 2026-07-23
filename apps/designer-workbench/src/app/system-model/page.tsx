'use client';

import { useState } from 'react';
import SystemModel, { SystemModelData } from '../../../components/SystemModel';

export default function SystemModelPage() {
  const [data, setData] = useState<SystemModelData>({ devices: [] });

  return (
    <main className="h-screen w-screen flex flex-col p-4 gap-2">
      <h1 className="text-lg font-semibold">Rysnova System Model · W-BIM-4 3.4</h1>
      <div className="flex-1 min-h-0">
        <SystemModel data={data} onChange={setData} />
      </div>
      <div className="text-xs text-gray-500">
        当前设备总数：{data.devices.length}
      </div>
    </main>
  );
}
