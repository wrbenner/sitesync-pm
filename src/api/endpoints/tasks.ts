import { mockFetch } from '../client';
import { tasks } from '../../data/mockData';

export const getTasks = () => mockFetch(tasks);
export const getTaskById = (id: number) => mockFetch(tasks.find((t) => t.id === id) ?? null);
