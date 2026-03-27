import { mockFetch } from '../client';
import { schedulePhases } from '../../data/mockData';

export const getSchedulePhases = () => mockFetch(schedulePhases);
