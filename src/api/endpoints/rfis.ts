import { mockFetch } from '../client';
import { rfis } from '../../data/mockData';

export const getRfis = () => mockFetch(rfis);
export const getRfiById = (id: number) => mockFetch(rfis.find((r) => r.id === id) ?? null);
