import { mockFetch } from '../client';
import { dailyLogHistory, recentCaptures, punchList } from '../../data/mockData';

export const getDailyLogs = () => mockFetch(dailyLogHistory);
export const getFieldCaptures = () => mockFetch(recentCaptures);
export const getPunchList = () => mockFetch(punchList);
