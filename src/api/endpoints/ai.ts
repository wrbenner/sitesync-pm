import { mockFetch } from '../client';
import { aiInsights, aiCopilotConversation, visionContent } from '../../data/mockData';

export const getAiInsights = () => mockFetch(aiInsights);
export const getAiConversation = () => mockFetch(aiCopilotConversation);
export const getVisionContent = () => mockFetch(visionContent);
