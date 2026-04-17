export interface ParsedActivity {
  activityId: string;
  name: string;
  startDate: string;
  endDate: string;
  duration: number;
  percentComplete: number;
  floatTotal: number;
  status: string;
  baselineStart?: string;
  baselineEnd?: string;
}
