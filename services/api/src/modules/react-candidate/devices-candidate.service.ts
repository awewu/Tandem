import { Injectable } from '@nestjs/common';

const FALLBACK_DEVICES = [
  { id: 'rheem-dhw-300', system: 'central-hot-water', brand: 'Rheem', name: 'Rheem central hot water pack' },
  { id: 'ruud-air-doas', system: 'whole-air', brand: 'Ruud', name: 'Ruud whole-air and DOAS pack' },
  { id: 'rysnova-water-quality', system: 'water-quality', brand: '瑞诺瓦', name: '瑞诺瓦水质系统包' },
];

@Injectable()
export class DevicesCandidateService {
  async categoriesStats() {
    return { 'central-hot-water': 1, 'whole-air': 1, 'water-quality': 1 };
  }

  async search(query?: string) {
    if (!query) return FALLBACK_DEVICES;
    return FALLBACK_DEVICES.filter((d) =>
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.id.toLowerCase().includes(query.toLowerCase()),
    );
  }

  async list(query: { system?: string; brand?: string; search?: string }) {
    let items = [...FALLBACK_DEVICES];
    if (query.system && query.system !== 'all') {
      items = items.filter((d) => d.system === query.system);
    }
    if (query.brand === 'rheem') {
      items = items.filter((d) => d.brand === 'Rheem');
    } else if (query.brand === 'third') {
      items = items.filter((d) => d.brand !== 'Rheem');
    }
    if (query.search) {
      items = items.filter((d) => d.name.toLowerCase().includes(query.search!.toLowerCase()));
    }
    return items;
  }

  async get(id: string) {
    return FALLBACK_DEVICES.find((d) => d.id === id) ?? { id };
  }
}
