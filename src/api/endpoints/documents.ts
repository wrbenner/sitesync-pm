import { mockFetch } from '../client';
import { drawings, files } from '../../data/mockData';

export const getDrawings = () => mockFetch(drawings);
export const getFiles = () => mockFetch(files);
