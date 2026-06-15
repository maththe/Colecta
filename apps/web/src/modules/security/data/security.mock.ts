import type { SecurityCamera, SecurityLocation } from '../types';

export const SECURITY_CAMERAS: SecurityCamera[] = [
  {
    id: 'cam-portaria-norte-01',
    code: 'CAM-001',
    name: 'Portaria Norte - Entrada',
    locationId: 'loc-portaria-norte',
    locationName: 'Portaria Norte',
    target: {
      kind: 'location',
      id: 'loc-portaria-norte',
      name: 'Portaria Norte',
    },
    status: 'online',
    model: 'Hikvision DS-2CD2143G2',
    ipAddress: '10.10.12.21',
    resolution: '1920x1080',
    fps: 30,
    lastSeenAt: '2026-06-15T17:42:00-03:00',
    imageUrl: '/security/cameras/portaria-norte-entrada.jpg',
    notes: 'Cobertura da entrada principal e catracas.',
  },
  {
    id: 'cam-portaria-norte-02',
    code: 'CAM-002',
    name: 'Portaria Norte - Lixeira PRQ-001',
    locationId: 'loc-portaria-norte',
    locationName: 'Portaria Norte',
    target: {
      kind: 'trash_bin',
      id: 'bin-prq-001',
      name: 'Lixeira da portaria',
      code: 'PRQ-001',
    },
    status: 'online',
    model: 'Intelbras VIP 1230',
    ipAddress: '10.10.12.22',
    resolution: '1280x720',
    fps: 24,
    lastSeenAt: '2026-06-15T17:40:00-03:00',
    imageUrl: '/security/cameras/portaria-norte-lixeira.jpg',
    notes: 'Foco no ponto de descarte junto a entrada.',
  },
  {
    id: 'cam-playground-01',
    code: 'CAM-003',
    name: 'Playground Central - Visão geral',
    locationId: 'loc-playground-central',
    locationName: 'Playground Central',
    target: {
      kind: 'location',
      id: 'loc-playground-central',
      name: 'Playground Central',
    },
    status: 'maintenance',
    model: 'Dahua IPC-HFW2431S',
    ipAddress: '10.10.18.14',
    resolution: '1920x1080',
    fps: 25,
    lastSeenAt: '2026-06-15T13:10:00-03:00',
    imageUrl: '/security/cameras/playground-central.jpg',
    notes: 'Aguardando ajuste de foco.',
  },
  {
    id: 'cam-lago-01',
    code: 'CAM-004',
    name: 'Lago dos Ipês - Lixeira PRQ-018',
    locationId: 'loc-lago-ipes',
    locationName: 'Lago dos Ipês',
    target: {
      kind: 'trash_bin',
      id: 'bin-prq-018',
      name: 'Lixeira do deque',
      code: 'PRQ-018',
    },
    status: 'online',
    model: 'Axis M2035-LE',
    ipAddress: '10.10.22.9',
    resolution: '1920x1080',
    fps: 30,
    lastSeenAt: '2026-06-15T17:39:00-03:00',
    imageUrl: '/security/cameras/lago-ipes-deque.jpg',
    notes: 'Cobre a área do deque e o ponto de coleta.',
  },
  {
    id: 'cam-trilha-01',
    code: 'CAM-005',
    name: 'Trilha Oeste - Ponto 3',
    locationId: 'loc-trilha-oeste',
    locationName: 'Trilha Oeste',
    target: {
      kind: 'location',
      id: 'loc-trilha-oeste',
      name: 'Trilha Oeste',
    },
    status: 'offline',
    model: 'Intelbras VIP 3230',
    ipAddress: '10.10.24.33',
    resolution: '1280x720',
    fps: 20,
    lastSeenAt: '2026-06-14T21:12:00-03:00',
    imageUrl: '/security/cameras/trilha-oeste-ponto-3.jpg',
    notes: 'Sem comunicação desde a noite anterior.',
  },
];

export function getSecurityLocations(): SecurityLocation[] {
  const locations = new Map<string, SecurityLocation>();

  for (const camera of SECURITY_CAMERAS) {
    const current = locations.get(camera.locationId);
    if (current) {
      current.cameras.push(camera);
    } else {
      locations.set(camera.locationId, {
        id: camera.locationId,
        name: camera.locationName,
        cameras: [camera],
      });
    }
  }

  return Array.from(locations.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'pt-BR'),
  );
}
