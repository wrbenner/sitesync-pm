// AI annotations: proactive insights attached to specific data points across the app.
// Each annotation references an entity by type + id and provides AI analysis.

export type AnnotationSeverity = 'critical' | 'warning' | 'info' | 'positive';
export type AnnotationCategory = 'schedule' | 'budget' | 'safety' | 'quality' | 'productivity' | 'coordination';

export interface AIAnnotation {
  id: string;
  entityType: 'rfi' | 'submittal' | 'task' | 'budget_division' | 'change_order' | 'crew' | 'schedule_phase' | 'punch_item' | 'drawing';
  entityId: number | string;
  severity: AnnotationSeverity;
  category: AnnotationCategory;
  title: string;
  insight: string;
  reasoning: string;
  suggestedAction: string;
  actionRoute?: string;
  confidence: number; // 0-100
}

export const aiAnnotations: AIAnnotation[] = [
  // RFI annotations
  {
    id: 'ann-rfi-1',
    entityType: 'rfi',
    entityId: 1,
    severity: 'warning',
    category: 'schedule',
    title: 'RFI aging beyond average',
    insight: 'RFI-001 has been open 6 days. Average resolution for similar interior finish RFIs is 4.2 days.',
    reasoning: 'Based on historical analysis of 47 interior finish RFIs across 3 projects, this RFI is in the 78th percentile for response time. Pattern suggests architect review bottleneck.',
    suggestedAction: 'Send follow up to Morris Architects. Consider scheduling a 15 min call to resolve.',
    actionRoute: 'rfis',
    confidence: 82,
  },
  {
    id: 'ann-rfi-3',
    entityType: 'rfi',
    entityId: 3,
    severity: 'critical',
    category: 'schedule',
    title: 'RFI blocking critical path',
    insight: 'RFI-003 (HVAC zoning) is 2 days overdue and blocking MEP rough in on Floor 8.',
    reasoning: 'This RFI feeds into the MEP phase which is on the critical path. Each day of delay shifts the MEP completion date and cascades into interior framing.',
    suggestedAction: 'Escalate to MEP Consultant. This is a critical path blocker.',
    actionRoute: 'rfis',
    confidence: 94,
  },
  {
    id: 'ann-rfi-4',
    entityType: 'rfi',
    entityId: 4,
    severity: 'critical',
    category: 'coordination',
    title: 'Structural connection detail urgent',
    insight: 'RFI-004 is blocking exterior crew progress on the south face. 16 workers affected.',
    reasoning: 'Curtain wall installation cannot proceed without resolved connection detail. Crew D has been partially idle for 2 days.',
    suggestedAction: 'Structural engineer response needed within 24 hours to avoid $18K holding costs.',
    actionRoute: 'rfis',
    confidence: 96,
  },

  // Budget annotations
  {
    id: 'ann-budget-structural',
    entityType: 'budget_division',
    entityId: 1,
    severity: 'critical',
    category: 'budget',
    title: 'Budget contingency depleted',
    insight: 'Structural division at 97% budget utilization with $250K committed. Any additional change orders will exceed budget.',
    reasoning: 'Spent $8.65M of $8.9M budget with $250K in commitments. Remaining contingency is effectively zero. CO-001 ($125K) consumed most buffer.',
    suggestedAction: 'Flag for owner review. Recommend reallocating $200K from Interior contingency.',
    actionRoute: 'budget',
    confidence: 98,
  },
  {
    id: 'ann-budget-electrical',
    entityType: 'budget_division',
    entityId: 3,
    severity: 'warning',
    category: 'budget',
    title: 'Electrical trending over',
    insight: 'Electrical at 50% spend but only 40% through scope. Projected 8% overrun at completion.',
    reasoning: 'Linear projection based on current burn rate vs remaining scope. The electrical panel relocation (CO-003) added unplanned complexity.',
    suggestedAction: 'Review remaining electrical scope for value engineering opportunities.',
    actionRoute: 'budget',
    confidence: 76,
  },
  {
    id: 'ann-co-2',
    entityType: 'change_order',
    entityId: 2,
    severity: 'warning',
    category: 'budget',
    title: 'CO-002 impact analysis',
    insight: 'HVAC upgrade CO ($95K) will push Mechanical to 92% budget utilization before equipment install phase.',
    reasoning: 'Mechanical division has $620K remaining after current commitments. The upgrade adds $95K but equipment install phase typically runs 15% over initial estimates.',
    suggestedAction: 'Negotiate scope reduction or phase the upgrade to spread cost.',
    actionRoute: 'budget',
    confidence: 71,
  },

  // Schedule annotations
  {
    id: 'ann-phase-mep',
    entityType: 'schedule_phase',
    entityId: 4,
    severity: 'warning',
    category: 'schedule',
    title: 'MEP phase slipping',
    insight: 'MEP at 62% but should be at 68% based on timeline. Trending 6 days behind schedule.',
    reasoning: 'Comparing progress curve to planned curve. Unanswered RFI-003 and submittal review delays are primary contributors.',
    suggestedAction: 'Accelerate MEP rough in on floors 4 through 6. Consider overtime authorization.',
    actionRoute: 'schedule',
    confidence: 85,
  },
  {
    id: 'ann-phase-exterior',
    entityType: 'schedule_phase',
    entityId: 5,
    severity: 'warning',
    category: 'schedule',
    title: 'Exterior weather exposure',
    insight: 'Exterior phase at 55%. Weather forecast shows 3 rain days next week, likely impacting curtain wall install.',
    reasoning: 'Historical data shows curtain wall work loses an average of 1.5 days per rain event. Combined with RFI-004 delay, exterior is the new schedule risk.',
    suggestedAction: 'Prioritize interior scope during rain window. Pre-stage curtain wall panels for rapid install when clear.',
    actionRoute: 'schedule',
    confidence: 79,
  },

  // Task annotations
  {
    id: 'ann-task-1',
    entityType: 'task',
    entityId: 1,
    severity: 'critical',
    category: 'schedule',
    title: 'Critical path task at risk',
    insight: 'Floor 7 steel erection is 67% complete but due in 1 day. Completion unlikely without overtime.',
    reasoning: 'At current pace (4 of 6 subtasks), estimated completion is 2 days past due date. This is on the critical path.',
    suggestedAction: 'Authorize Saturday overtime for Steel Crew A. Estimated cost: $4,200.',
    actionRoute: 'tasks',
    confidence: 91,
  },
  {
    id: 'ann-task-12',
    entityType: 'task',
    entityId: 12,
    severity: 'critical',
    category: 'schedule',
    title: 'Procurement urgency',
    insight: 'Secondary steel supplier quote needed by EOD. Tulsa supplier confirmed availability but quote expires tomorrow.',
    reasoning: 'This procurement decision has a $19K net savings vs waiting for Phoenix supplier. Time sensitivity is high.',
    suggestedAction: 'Approve Tulsa expedited delivery. Net savings of $19K plus 4 days schedule recovery.',
    actionRoute: 'tasks',
    confidence: 93,
  },

  // Submittal annotations
  {
    id: 'ann-sub-2',
    entityType: 'submittal',
    entityId: 2,
    severity: 'warning',
    category: 'coordination',
    title: 'Review bottleneck',
    insight: 'SUB-002 (Mechanical specs) has been under review for 8 days. Average review time is 5 days.',
    reasoning: 'This submittal is needed before HVAC equipment procurement. Each day of review delay potentially shifts procurement by 1.5 days due to lead times.',
    suggestedAction: 'Follow up with MEP Consultant. This feeds into the HVAC upgrade timeline.',
    actionRoute: 'submittals',
    confidence: 84,
  },
  {
    id: 'ann-sub-3',
    entityType: 'submittal',
    entityId: 3,
    severity: 'info',
    category: 'quality',
    title: 'Revision pattern detected',
    insight: 'SUB-003 is on second revision. Door hardware submittals have a 60% first pass rejection rate on this project.',
    reasoning: 'Of 5 hardware submittals submitted, 3 required revision. Common issue is specification misalignment between architect and supplier.',
    suggestedAction: 'Schedule pre-submission review with architect to improve first pass rate.',
    actionRoute: 'submittals',
    confidence: 72,
  },

  {
    id: 'ann-sub-4',
    entityType: 'submittal',
    entityId: 4,
    severity: 'warning',
    category: 'schedule',
    title: 'Procurement dependency',
    insight: 'SUB-004 (Electrical Panel Specs) is pending review and blocks panel procurement. Lead time is 8 weeks.',
    reasoning: 'Electrical panel procurement has an 8 week lead time. Each day of submittal delay pushes panel delivery further into the interior finishing phase.',
    suggestedAction: 'Prioritize this submittal review to maintain electrical rough in schedule.',
    actionRoute: 'submittals',
    confidence: 80,
  },

  // Task additional annotations
  {
    id: 'ann-task-3',
    entityType: 'task',
    entityId: 3,
    severity: 'critical',
    category: 'coordination',
    title: 'Blocking exterior progress',
    insight: 'Curtain wall interface detail resolution is blocking 16 workers on the south face.',
    reasoning: 'Exterior Crew D cannot proceed without this structural connection detail. Holding cost is approximately $9K per day.',
    suggestedAction: 'Schedule emergency coordination call with structural engineer today.',
    actionRoute: 'tasks',
    confidence: 95,
  },
  {
    id: 'ann-task-7',
    entityType: 'task',
    entityId: 7,
    severity: 'info',
    category: 'budget',
    title: 'CO review opportunity',
    insight: 'CO-002 HVAC upgrade review is nearly complete (3 of 4 subtasks done). Expediting final review could save 2 days.',
    reasoning: 'This change order approval feeds into equipment procurement. The final subtask is owner recommendation, which could be fast tracked.',
    suggestedAction: 'Prepare owner recommendation memo for Thursday OAC meeting.',
    actionRoute: 'tasks',
    confidence: 74,
  },
  {
    id: 'ann-task-11',
    entityType: 'task',
    entityId: 11,
    severity: 'warning',
    category: 'coordination',
    title: 'Multi trade coordination needed',
    insight: 'Elevator shaft MEP routing involves 3 trades. No coordination meeting has been scheduled yet.',
    reasoning: 'Mechanical, electrical, and plumbing all need to agree on final routing before framing closes. This is a common clash point.',
    suggestedAction: 'Schedule a 3 trade coordination meeting this week. Invite all MEP subcontractors.',
    actionRoute: 'tasks',
    confidence: 86,
  },

  // Crew annotations
  {
    id: 'ann-crew-4',
    entityType: 'crew',
    entityId: 4,
    severity: 'warning',
    category: 'productivity',
    title: 'Declining productivity trend',
    insight: 'Exterior Crew D productivity has dropped from 85% to 78% over the past 2 weeks.',
    reasoning: 'Trend analysis shows 7 point decline correlating with RFI-004 delay. Crew is partially idle waiting for structural connection resolution.',
    suggestedAction: 'Redirect crew to secondary facade sections while RFI-004 is resolved.',
    actionRoute: 'crews',
    confidence: 88,
  },
  {
    id: 'ann-crew-6',
    entityType: 'crew',
    entityId: 6,
    severity: 'info',
    category: 'productivity',
    title: 'Standby crew opportunity',
    insight: 'Finishing Crew F on standby. Lower level drywall is ready for this crew.',
    reasoning: 'Crew has been on standby for 2 days. Lower level finishing scope is ready and could be started immediately.',
    suggestedAction: 'Activate Crew F on lower level finishes to recover 2 lost standby days.',
    actionRoute: 'crews',
    confidence: 90,
  },

  // Drawing annotations
  {
    id: 'ann-drawing-4',
    entityType: 'drawing',
    entityId: 4,
    severity: 'info',
    category: 'coordination',
    title: 'Revision may be needed',
    insight: 'M-001 (HVAC diagram) may need revision based on CO-002 HVAC upgrade scope.',
    reasoning: 'Change order CO-002 modifies HVAC system specs. Current drawing reflects pre-upgrade layout.',
    suggestedAction: 'Confirm with HVAC contractor whether drawing revision is needed before equipment procurement.',
    actionRoute: 'drawings',
    confidence: 68,
  },

  // Punch list annotations
  {
    id: 'ann-punch-3',
    entityType: 'punch_item',
    entityId: 3,
    severity: 'warning',
    category: 'safety',
    title: 'Safety related item aging',
    insight: 'PL-003 (door closer) is a safety item in the parking garage. Open for 5 days.',
    reasoning: 'Safety related punch items should be resolved within 48 hours per project safety plan. This item is 3 days overdue.',
    suggestedAction: 'Escalate to Robert Chen. Safety items require priority resolution.',
    actionRoute: 'punch-list',
    confidence: 95,
  },
];

// Per-page predictive alerts
export interface PredictiveAlertData {
  id: string;
  page: string;
  severity: AnnotationSeverity;
  title: string;
  description: string;
  reasoning: string;
  impact: string;
  confidence: number;
  actionLabel: string;
  actionRoute: string;
}

export const predictiveAlerts: PredictiveAlertData[] = [
  {
    id: 'pa-schedule-1',
    page: 'schedule',
    severity: 'warning',
    title: 'MEP rough in trending 6 days behind',
    description: 'If uncorrected, impacts interior framing start date by 4 days.',
    reasoning: 'Progress curve analysis shows MEP at 62% vs planned 68%. Primary drivers: RFI-003 delay (3 days), submittal review backlog (2 days), weather (1 day).',
    impact: 'Interior framing delayed 4 days. Finishes phase compressed by 1 week. $32K estimated delay cost.',
    confidence: 85,
    actionLabel: 'View Recovery Plan',
    actionRoute: 'schedule',
  },
  {
    id: 'pa-budget-1',
    page: 'budget',
    severity: 'critical',
    title: 'Electrical division at 93% budget with 40% work remaining',
    description: 'Projected 8% overrun ($408K) without corrective action.',
    reasoning: 'Current burn rate of $127K/week against remaining $2.55M scope. Panel relocation CO-003 added unplanned complexity. Subcontractor billing trend is 12% above estimate.',
    impact: 'Total project budget impact: 0.86%. May trigger owner contingency draw.',
    confidence: 76,
    actionLabel: 'Review Cost Options',
    actionRoute: 'budget',
  },
  {
    id: 'pa-rfis-1',
    page: 'rfis',
    severity: 'warning',
    title: 'RFI cascade risk detected',
    description: 'Unanswered RFI-003 is blocking 2 downstream submittals and 1 procurement action.',
    reasoning: 'Dependency analysis shows RFI-003 feeds into SUB-002 review, HVAC equipment procurement, and floor 8 MEP coordination. Each day of RFI delay multiplies across these dependencies.',
    impact: '3 work items blocked. Estimated cascade delay: 5 to 8 days of downstream impact.',
    confidence: 88,
    actionLabel: 'Escalate RFI-003',
    actionRoute: 'rfis',
  },
  {
    id: 'pa-crews-1',
    page: 'crews',
    severity: 'info',
    title: 'Resource conflict Thursday',
    description: 'Exterior Crew D and Framing Crew E both scheduled for Floor 8 access.',
    reasoning: 'Material hoist schedule shows both crews planned for same logistics path on Thursday AM. Historical data shows this causes 2 to 3 hour delays for the second crew.',
    impact: 'Minor: 2 to 3 hours lost productivity. Easy to resolve with staggered start times.',
    confidence: 92,
    actionLabel: 'Adjust Schedule',
    actionRoute: 'crews',
  },
  {
    id: 'pa-tasks-1',
    page: 'tasks',
    severity: 'warning',
    title: '3 critical tasks due within 48 hours',
    description: 'Steel erection, curtain wall detail, and supplier quote all need immediate attention.',
    reasoning: 'These three tasks are interconnected. Supplier quote informs steel procurement, which enables continued erection, which blocks curtain wall interface.',
    impact: 'If any one task slips, the other two are likely to cascade. Combined schedule impact: up to 2 weeks.',
    confidence: 90,
    actionLabel: 'View Critical Tasks',
    actionRoute: 'tasks',
  },
  {
    id: 'pa-submittals-1',
    page: 'submittals',
    severity: 'info',
    title: 'Submittal review velocity improving',
    description: 'Average review time has decreased from 6.2 to 4.8 days over the past month.',
    reasoning: 'Pattern analysis shows the Tuesday batch review process recommended by AI is working. 3 of last 5 submittals resolved within 4 days.',
    impact: 'Positive trend. Maintaining this velocity will recover 8 days of schedule float by month end.',
    confidence: 74,
    actionLabel: 'View Analytics',
    actionRoute: 'submittals',
  },
];

// Per-page AI context analysis
export interface AIContextAnalysis {
  page: string;
  summary: string;
  insights: { label: string; value: string; trend?: 'up' | 'down' | 'flat'; severity?: AnnotationSeverity }[];
  recommendation: string;
}

export const aiContextAnalyses: AIContextAnalysis[] = [
  {
    page: 'dashboard',
    summary: 'Project health is moderate at 87/100. Two critical items need attention today.',
    insights: [
      { label: 'Schedule Health', value: '4 days ahead', trend: 'down', severity: 'warning' },
      { label: 'Budget Health', value: '1.2% under', trend: 'flat', severity: 'positive' },
      { label: 'Safety Score', value: '96/100', trend: 'up', severity: 'positive' },
      { label: 'Active Risks', value: '7 items', severity: 'warning' },
    ],
    recommendation: 'Prioritize RFI-003 escalation and steel supplier decision today. Both have cascading schedule impacts.',
  },
  {
    page: 'drawings',
    summary: '3 coordination conflicts detected between MEP and structural drawing sets.',
    insights: [
      { label: 'Active Sets', value: '6 sets' },
      { label: 'Pending Revisions', value: '2 sets', severity: 'warning' },
      { label: 'Coordination Clashes', value: '3 found', severity: 'critical' },
      { label: 'Last Updated', value: '2 days ago' },
    ],
    recommendation: 'M-001 HVAC diagram needs revision based on CO-002 scope. Schedule coordination review with structural team.',
  },
  {
    page: 'budget',
    summary: 'Cost trend analysis projects 4.2% overrun by project end without corrective action.',
    insights: [
      { label: 'Projected Overrun', value: '$1.99M', severity: 'critical' },
      { label: 'Contingency Remaining', value: '$3.8M', severity: 'warning' },
      { label: 'At Risk Divisions', value: '2 of 5', severity: 'warning' },
      { label: 'Change Orders Pending', value: '$95K' },
    ],
    recommendation: 'Structural and Electrical divisions need immediate attention. Consider value engineering on electrical scope.',
  },
  {
    page: 'schedule',
    summary: 'Critical path has shifted. New bottleneck: MEP rough in and elevator shaft coordination.',
    insights: [
      { label: 'Critical Path Items', value: '4 active', severity: 'warning' },
      { label: 'Schedule Variance', value: '6 days behind', trend: 'down', severity: 'warning' },
      { label: 'Float Available', value: '12 days' },
      { label: 'Weather Risk Days', value: '3 next week', severity: 'info' },
    ],
    recommendation: 'Authorize MEP overtime to recover 4 days. Pre-stage materials for weather window.',
  },
  {
    page: 'rfis',
    summary: 'Pattern detected: 68% of RFIs from floors 8 to 10 are MEP coordination issues.',
    insights: [
      { label: 'Open RFIs', value: '3 items', severity: 'warning' },
      { label: 'Overdue', value: '1 item', severity: 'critical' },
      { label: 'Avg Response Time', value: '3.5 days' },
      { label: 'Cascade Risk', value: '2 RFIs', severity: 'warning' },
    ],
    recommendation: 'Batch MEP RFIs for Tuesday review cycle. Escalate RFI-003 and RFI-004 separately due to urgency.',
  },
  {
    page: 'submittals',
    summary: 'Review velocity improving but 2 submittals need attention.',
    insights: [
      { label: 'Under Review', value: '1 item' },
      { label: 'Pending', value: '1 item', severity: 'warning' },
      { label: 'Avg Review Time', value: '4.8 days', trend: 'up', severity: 'positive' },
      { label: 'Rejection Rate', value: '25%' },
    ],
    recommendation: 'SUB-002 review is overdue. Follow up with MEP Consultant to maintain improving velocity trend.',
  },
  {
    page: 'tasks',
    summary: '3 critical tasks converging this week. Coordinated action needed.',
    insights: [
      { label: 'Critical Tasks', value: '3 active', severity: 'critical' },
      { label: 'Due This Week', value: '5 tasks', severity: 'warning' },
      { label: 'Blocked Tasks', value: '1 task', severity: 'warning' },
      { label: 'Completion Rate', value: '78%', trend: 'up', severity: 'positive' },
    ],
    recommendation: 'Focus on the steel erection, supplier quote, and curtain wall detail cluster. These are interconnected.',
  },
  {
    page: 'crews',
    summary: 'Overall crew utilization at 82%. One crew trending down, one on standby.',
    insights: [
      { label: 'Active Crews', value: '5 of 6' },
      { label: 'Total On Site', value: '70 workers' },
      { label: 'Declining Productivity', value: '1 crew', severity: 'warning' },
      { label: 'Standby', value: '1 crew', severity: 'info' },
    ],
    recommendation: 'Activate Crew F on lower level finishes. Redirect Crew D to secondary facade areas.',
  },
  {
    page: 'punch-list',
    summary: '1 safety related item overdue. Overall punch list trending well.',
    insights: [
      { label: 'Open Items', value: '3 items' },
      { label: 'Safety Overdue', value: '1 item', severity: 'critical' },
      { label: 'Avg Resolution', value: '3.2 days' },
      { label: 'Completion Rate', value: '40%', trend: 'up' },
    ],
    recommendation: 'Escalate PL-003 (door closer in parking garage) immediately. Safety items require 48 hour resolution.',
  },
];

// Helper to get annotations for a specific entity
export function getAnnotationsForEntity(entityType: AIAnnotation['entityType'], entityId: number | string): AIAnnotation[] {
  return aiAnnotations.filter((a) => a.entityType === entityType && a.entityId === entityId);
}

export function getAnnotationsForPage(page: string): AIAnnotation[] {
  const pageEntityMap: Record<string, AIAnnotation['entityType'][]> = {
    rfis: ['rfi'],
    submittals: ['submittal'],
    tasks: ['task'],
    budget: ['budget_division', 'change_order'],
    schedule: ['schedule_phase'],
    crews: ['crew'],
    drawings: ['drawing'],
    'punch-list': ['punch_item'],
  };
  const types = pageEntityMap[page] || [];
  return aiAnnotations.filter((a) => types.includes(a.entityType));
}

export function getPredictiveAlertsForPage(page: string): PredictiveAlertData[] {
  return predictiveAlerts.filter((a) => a.page === page);
}

export function getContextAnalysisForPage(page: string): AIContextAnalysis | undefined {
  return aiContextAnalyses.find((a) => a.page === page);
}
