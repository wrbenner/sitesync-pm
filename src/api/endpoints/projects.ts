import { mockFetch } from '../client';
import { projectData, metrics } from '../../data/mockData';

export const getProject = () => mockFetch(projectData);
export const getMetrics = () => mockFetch(metrics);
