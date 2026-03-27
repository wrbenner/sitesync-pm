import { mockFetch } from '../client';
import { activityFeed } from '../../data/mockData';

export const getActivityFeed = () => mockFetch(activityFeed);
