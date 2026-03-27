import { mockFetch } from '../client';
import { crews, directory, meetings, upcomingMeetings } from '../../data/mockData';

export const getCrews = () => mockFetch(crews);
export const getDirectory = () => mockFetch(directory);
export const getMeetings = () => mockFetch(meetings);
export const getUpcomingMeetings = () => mockFetch(upcomingMeetings);
