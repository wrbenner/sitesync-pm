import { mockFetch } from '../client';
import { submittals } from '../../data/mockData';

export const getSubmittals = () => mockFetch(submittals);
export const getSubmittalById = (id: number) => mockFetch(submittals.find((s) => s.id === id) ?? null);
