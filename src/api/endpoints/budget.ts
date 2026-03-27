import { mockFetch } from '../client';
import { costData } from '../../data/mockData';

export const getCostData = () => mockFetch(costData);
