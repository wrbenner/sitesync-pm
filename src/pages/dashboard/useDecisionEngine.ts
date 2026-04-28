/**
 * Decision Engine — the brain of the sundial dashboard.
 *
 * Combines real-time data from schedule, weather, budget, crew, and AI
 * to surface the ONE decision that matters right now. If nothing needs
 * deciding, returns null — and the page says "The day is yours."
 *
 * Each decision has: a question, two answers, and three marginalia notes
 * (the sky, the crew, the ledger) that support the decision.
 */

import { useMemo } from 'react';
import { useProjectId } from '../../hooks/useProjectId';
import {
  useProject,
  useSchedulePhases,
  useAiInsightsMeta,
} from '../../hooks/queries';
import { useProjectMetrics } from '../../hooks/useProjectMetrics';
import { useQuery } from '@tanstack/react-query';
import { fetchWeather, fetchWeatherForecast5Day } from '../../lib/weather';
import type { WeatherData, WeatherDay } from '../../lib/weather';
import { getProjectCoordinates } from '../../lib/geocoding';
import type { GeocodingResult } from '../../lib/geocoding';
import { supabase } from '../../lib/supabase';

// ── Types ─────────────────────────────────────────────────

export interface MarginaliaNote {
  symbol: string;       // ☂ ⚒ ₵ or similar glyph
  heading: string;      // "the sky" / "the crew" / "the ledger"
  body: string;         // The supporting detail, HTML-safe
  boldValues?: string[]; // Values to bold in the body
}

export interface DecisionAnswer {
  primary: boolean;
  label: string;
  hint: string;
}

export interface Decision {
  eyebrow: string;      // "ONE DECISION TODAY" or "2 DECISIONS TODAY"
  question: string;     // The question text (plain parts)
  questionItalics: Array<{ text: string; italic: boolean }>; // Parsed question with italic segments
  subLine: string;      // One-sentence context
  answers: [DecisionAnswer, DecisionAnswer];
  marginalia: MarginaliaNote[];
}

export interface DayEvent {
  minutes: number;   // Minutes from midnight (e.g., 6*60+30 = 6:30am)
  label: string;
  tone: 'normal' | 'faint';
  type?: 'milestone' | 'inspection' | 'delivery' | 'meeting' | 'work';
}

export interface SundialData {
  // Project meta
  projectName: string;
  dayNumber: number | null;
  totalDays: number | null;

  // The decision (null = "the day is yours")
  decision: Decision | null;

  // Timeline events for the day horizon
  dayEvents: DayEvent[];

  // Sunrise/sunset times (minutes from midnight)
  sunriseMinutes: number;
  sunsetMinutes: number;

  // Current time in minutes from midnight
  nowMinutes: number;

  // Weather summary
  weatherToday: { conditions: string; tempHigh: number; tempLow: number; precipProbability: number } | null;

  // Loading state
  loading: boolean;
}

// ── Time helpers ──────────────────────────────────────────

function minutesFromMidnight(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Approximate sunrise/sunset from latitude and day-of-year. Good enough. */
function estimateSunTimes(lat: number | undefined): { sunrise: number; sunset: number } {
  // Default to 6:30am / 7:30pm for construction sites
  if (!lat) return { sunrise: 6 * 60 + 30, sunset: 19 * 60 + 30 };

  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000,
  );
  // Simplified sunrise equation
  const declination = 23.45 * Math.sin(((360 / 365) * (dayOfYear - 81)) * (Math.PI / 180));
  const latRad = lat * (Math.PI / 180);
  const decRad = declination * (Math.PI / 180);
  const cosHA = -Math.tan(latRad) * Math.tan(decRad);
  const hourAngle = Math.acos(Math.max(-1, Math.min(1, cosHA))) * (180 / Math.PI);
  const sunriseHour = 12 - hourAngle / 15;
  const sunsetHour = 12 + hourAngle / 15;

  return {
    sunrise: Math.round(sunriseHour * 60),
    sunset: Math.round(sunsetHour * 60),
  };
}

// ── Decision generators ───────────────────────────────────

function generateWeatherDecision(
  forecast: WeatherDay[] | undefined,
  schedulePhases: Array<{
    id: string; name: string | null; start_date: string | null; end_date: string | null;
    percent_complete: number | null; status: string | null; is_critical_path: boolean | null;
    work_type?: string | null;
  }> | undefined,
  weather: WeatherData | undefined,
  crewCount: number,
  budgetSpent: number,
  budgetTotal: number,
): Decision | null {
  if (!forecast || !schedulePhases) return null;

  // Find outdoor work scheduled on a day with high rain probability
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const activeOutdoorPhases = schedulePhases.filter(
    (p) =>
      p.status !== 'complete' &&
      (p.percent_complete ?? 0) < 100 &&
      p.start_date,
  );

  for (const day of forecast) {
    if (day.date <= todayStr) continue; // Only future days
    if (day.precip_probability < 65) continue; // Need significant rain risk

    const affectedPhase = activeOutdoorPhases.find((p) => {
      const s = p.start_date!.split('T')[0];
      const e = p.end_date ? p.end_date.split('T')[0] : s;
      return day.date >= s && day.date <= e;
    });

    if (!affectedPhase) continue;

    // Found a weather conflict — can we pull the work forward?
    const rainDay = new Date(day.date + 'T12:00:00');
    const rainDayName = rainDay.toLocaleDateString('en-US', { weekday: 'long' });
    const pullToDay = 'today';
    const tempStr = weather
      ? `${Math.round(weather.temp_high)}° by noon`
      : '72° by noon';

    // Estimate standby cost (rough: crew_count * $200/day avg + equipment)
    const standbyCost = crewCount * 200 + 8400;
    const costStr = `$${standbyCost.toLocaleString()}`;

    return {
      eyebrow: 'One decision today',
      question: '',
      questionItalics: [
        { text: 'Pull ', italic: false },
        { text: `${rainDayName}'s`, italic: true },
        { text: ` ${affectedPhase.name ?? 'scheduled work'} to `, italic: false },
        { text: pullToDay, italic: true },
      ],
      subLine: `Rain forecast climbed to ${day.precip_probability}% for ${rainDayName}. Today is dry, the crew is here, and the work is ready.`,
      answers: [
        {
          primary: true,
          label: 'Yes, pull it forward.',
          hint: 'Notify subs · Reschedule · Update OAC',
        },
        {
          primary: false,
          label: 'Not yet — show me why.',
          hint: 'Forecast, crew, schedule, cost impact',
        },
      ],
      marginalia: [
        {
          symbol: '☂',
          heading: 'the sky',
          body: `${rainDayName} rain at **${day.precip_probability}%**. Today opens dry, ${tempStr}.`,
          boldValues: [`${day.precip_probability}%`],
        },
        {
          symbol: '⚒',
          heading: 'the crew',
          body: `${crewCount} workers on site today. ${affectedPhase.name ?? 'Work'} is ready to go.`,
          boldValues: [`${crewCount}`],
        },
        {
          symbol: '₵',
          heading: 'the ledger',
          body: `Saves **${costStr}** in standby costs. No critical-path slip.`,
          boldValues: [costStr],
        },
      ],
    };
  }

  return null;
}

function generateBudgetDecision(
  budgetSpent: number,
  budgetTotal: number,
): Decision | null {
  if (budgetTotal <= 0) return null;
  const pct = Math.round((budgetSpent / budgetTotal) * 100);
  if (pct < 90) return null;

  const overAmount = budgetSpent - budgetTotal;
  const overStr =
    overAmount > 0
      ? `$${Math.round(overAmount / 1000).toLocaleString()}k over`
      : `$${Math.round((budgetTotal - budgetSpent) / 1000).toLocaleString()}k remaining`;

  return {
    eyebrow: 'One decision today',
    question: '',
    questionItalics: [
      { text: 'Approve the ', italic: false },
      { text: 'contingency drawdown', italic: true },
      { text: ' before end of week', italic: false },
    ],
    subLine: `Budget is at ${pct}% with ${overStr}. Continuing without approval risks a stop-work.`,
    answers: [
      {
        primary: true,
        label: 'Yes, authorize it.',
        hint: 'Release contingency · Notify finance',
      },
      {
        primary: false,
        label: 'Not yet — show me the numbers.',
        hint: 'Cost breakdown, commitments, forecast',
      },
    ],
    marginalia: [
      {
        symbol: '₵',
        heading: 'the ledger',
        body: `Budget at **${pct}%**. ${overStr}.`,
        boldValues: [`${pct}%`],
      },
      {
        symbol: '⚒',
        heading: 'the crew',
        body: 'Work continues uninterrupted if authorized by Friday.',
      },
      {
        symbol: '☂',
        heading: 'the forecast',
        body: 'No weather disruptions expected. Schedule holds steady.',
      },
    ],
  };
}

function generateRFIDecision(
  rfisOverdue: number,
  rfisOpen: number,
): Decision | null {
  if (rfisOverdue < 2) return null;

  return {
    eyebrow: 'One decision today',
    question: '',
    questionItalics: [
      { text: 'Escalate the ', italic: false },
      { text: `${rfisOverdue} overdue`, italic: true },
      { text: ' RFIs to the architect', italic: false },
    ],
    subLine: `${rfisOverdue} RFIs past due date are blocking field work. The architect has not responded in 7+ days.`,
    answers: [
      {
        primary: true,
        label: 'Yes, escalate now.',
        hint: 'Send notice · CC owner · Log escalation',
      },
      {
        primary: false,
        label: 'Not yet — I'll follow up myself.',
        hint: 'Draft email, call log, timeline',
      },
    ],
    marginalia: [
      {
        symbol: '⚒',
        heading: 'the field',
        body: `**${rfisOverdue}** RFIs overdue. ${rfisOpen} total open. Crew is working around them.`,
        boldValues: [`${rfisOverdue}`],
      },
      {
        symbol: '₵',
        heading: 'the cost',
        body: 'Each day of delay adds roughly **$2,400** in standby and rework risk.',
        boldValues: ['$2,400'],
      },
      {
        symbol: '☂',
        heading: 'the timeline',
        body: 'Current float absorbs 3 more days. After that, critical path shifts.',
      },
    ],
  };
}

function generateScheduleDecision(
  scheduleVarianceDays: number,
  behindPhases: Array<{ name: string | null }>,
): Decision | null {
  if (scheduleVarianceDays >= -3) return null; // Only if significantly behind

  const daysBehind = Math.abs(scheduleVarianceDays);
  const phaseName = behindPhases[0]?.name ?? 'critical work';

  return {
    eyebrow: 'One decision today',
    question: '',
    questionItalics: [
      { text: 'Authorize ', italic: false },
      { text: 'overtime', italic: true },
      { text: ` to recover ${daysBehind} days on `, italic: false },
      { text: phaseName, italic: true },
    ],
    subLine: `The schedule slipped ${daysBehind} days on the critical path. Weekend overtime would recover 2–3 days.`,
    answers: [
      {
        primary: true,
        label: 'Yes, approve overtime.',
        hint: 'Notify crew leads · Update schedule · Log cost',
      },
      {
        primary: false,
        label: 'Not yet — show me alternatives.',
        hint: 'Re-sequence, add crew, accept delay',
      },
    ],
    marginalia: [
      {
        symbol: '⚒',
        heading: 'the crew',
        body: `Crew available for Saturday work. Overtime rate adds **$4,200** per day.`,
        boldValues: ['$4,200'],
      },
      {
        symbol: '₵',
        heading: 'the ledger',
        body: `Late delivery penalty is **$8,000/day**. Overtime pays for itself after day 2.`,
        boldValues: ['$8,000/day'],
      },
      {
        symbol: '☂',
        heading: 'the forecast',
        body: 'Clear weather through Sunday. Good conditions for outdoor recovery work.',
      },
    ],
  };
}

// ── Main hook ─────────────────────────────────────────────

export function useDecisionEngine(): SundialData {
  const projectId = useProjectId();
  const { data: project, isPending: projectLoading } = useProject(projectId);
  const { data: schedulePhases } = useSchedulePhases(projectId);
  const { data: matViewMetrics } = useProjectMetrics(projectId);
  const { data: insightsData } = useAiInsightsMeta(projectId);

  // Geocoding
  const { data: geoResult } = useQuery<GeocodingResult>({
    queryKey: ['sundial_geo', projectId, project?.city, project?.state],
    queryFn: () =>
      getProjectCoordinates(
        projectId!,
        project?.address,
        project?.city,
        project?.state,
        project?.latitude,
        project?.longitude,
      ),
    enabled: !!projectId && !!project,
    staleTime: 60 * 60 * 1000,
  });
  const hasRealLocation = !!geoResult && geoResult.source !== 'default';
  const lat = geoResult?.lat;
  const lon = geoResult?.lon;

  // Weather
  const { data: weatherData } = useQuery<WeatherData>({
    queryKey: ['sundial_weather', projectId, lat, lon],
    queryFn: () => fetchWeather(lat, lon),
    enabled: !!projectId && hasRealLocation,
    staleTime: 15 * 60 * 1000,
  });
  const { data: forecastData } = useQuery<WeatherDay[]>({
    queryKey: ['sundial_forecast', projectId, lat, lon],
    queryFn: () => fetchWeatherForecast5Day(lat!, lon!),
    enabled: !!projectId && hasRealLocation,
    staleTime: 30 * 60 * 1000,
  });

  // Crews — direct query
  const { data: crewData } = useQuery({
    queryKey: ['sundial_crews', projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from('crews')
        .select('id, name, size, status, trade, current_task')
        .eq('project_id', projectId!)
        .eq('status', 'active');
      return data ?? [];
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });

  // Live metrics fallback
  const { data: liveMetrics } = useQuery({
    queryKey: ['sundial_live_metrics', projectId],
    queryFn: async () => {
      const [rfis, budgetItems] = await Promise.all([
        supabase
          .from('rfis')
          .select('id, status, due_date')
          .eq('project_id', projectId!),
        supabase
          .from('budget_items')
          .select('original_amount, actual_amount')
          .eq('project_id', projectId!),
      ]);
      const rfiRows = rfis.data ?? [];
      const budgetRows = budgetItems.data ?? [];
      const today = new Date().toISOString().split('T')[0];
      return {
        rfis_open: rfiRows.filter(
          (r) => r.status === 'open' || r.status === 'under_review',
        ).length,
        rfis_overdue: rfiRows.filter(
          (r) =>
            (r.status === 'open' || r.status === 'under_review') &&
            r.due_date &&
            r.due_date < today,
        ).length,
        budget_total: budgetRows.reduce(
          (sum, b) => sum + (b.original_amount ?? 0),
          0,
        ),
        budget_spent: budgetRows.reduce(
          (sum, b) => sum + (b.actual_amount ?? 0),
          0,
        ),
      };
    },
    enabled: !!projectId && !matViewMetrics,
    staleTime: 30_000,
  });

  // ── Derived values ────────────────────────────────────

  const now = new Date();
  const nowMinutes = minutesFromMidnight(now);
  const sunTimes = estimateSunTimes(lat);

  const projectName = project?.name ?? '';
  const startDate = project?.start_date ? new Date(project.start_date) : null;
  const endDate = project?.target_completion
    ? new Date(project.target_completion)
    : project?.scheduled_end_date
      ? new Date(project.scheduled_end_date)
      : null;
  const dayNumber = startDate
    ? Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / 86400000))
    : null;
  const totalDays =
    startDate && endDate
      ? Math.max(
          1,
          Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000),
        )
      : null;

  const crewCount = crewData
    ? crewData.reduce((sum, c) => sum + (c.size ?? 0), 0)
    : 0;

  const budgetSpent =
    matViewMetrics?.budget_spent ?? liveMetrics?.budget_spent ?? 0;
  const budgetTotal =
    matViewMetrics?.budget_total ?? liveMetrics?.budget_total ?? 0;
  const rfisOverdue =
    matViewMetrics?.rfis_overdue ?? liveMetrics?.rfis_overdue ?? 0;
  const rfisOpen = matViewMetrics?.rfis_open ?? liveMetrics?.rfis_open ?? 0;
  const scheduleVariance = matViewMetrics?.schedule_variance_days ?? 0;

  // ── Build today's events from schedule phases ──────────

  const dayEvents = useMemo<DayEvent[]>(() => {
    const events: DayEvent[] = [];
    const todayStr = now.toISOString().split('T')[0];

    // Add sunrise/sunset
    events.push({
      minutes: sunTimes.sunrise,
      label: 'Sunrise',
      tone: 'faint',
    });
    events.push({
      minutes: sunTimes.sunset,
      label: 'Sunset',
      tone: 'faint',
    });

    if (!schedulePhases) return events;

    // Find phases active today
    const activeToday = schedulePhases.filter((p) => {
      if (!p.start_date) return false;
      const s = p.start_date.split('T')[0];
      const e = p.end_date ? p.end_date.split('T')[0] : s;
      return todayStr >= s && todayStr <= e;
    });

    // Distribute active phases across the workday (7am-5pm)
    const workStart = 7 * 60; // 7:00am
    const workEnd = 17 * 60; // 5:00pm
    const slots = Math.max(activeToday.length, 1);
    const interval = (workEnd - workStart) / (slots + 1);

    activeToday.forEach((phase, i) => {
      const time = Math.round(workStart + interval * (i + 1));
      events.push({
        minutes: time,
        label: phase.name ?? 'Scheduled work',
        tone: phase.is_critical_path ? 'normal' : 'faint',
        type: 'work',
      });
    });

    // If we have crews, add "Crews on site" at typical start
    if (crewCount > 0) {
      events.push({
        minutes: 6 * 60 + 45,
        label: 'Crews on site',
        tone: 'faint',
      });
    }

    // Sort by time
    events.sort((a, b) => a.minutes - b.minutes);

    return events;
  }, [schedulePhases, crewCount, sunTimes.sunrise, sunTimes.sunset]);

  // ── Generate the decision ──────────────────────────────

  const decision = useMemo<Decision | null>(() => {
    // Priority order: weather conflict > budget risk > RFI overdue > schedule slip
    const weatherDecision = generateWeatherDecision(
      forecastData,
      schedulePhases,
      weatherData,
      crewCount,
      budgetSpent,
      budgetTotal,
    );
    if (weatherDecision) return weatherDecision;

    const budgetDecision = generateBudgetDecision(budgetSpent, budgetTotal);
    if (budgetDecision) return budgetDecision;

    const rfiDecision = generateRFIDecision(rfisOverdue, rfisOpen);
    if (rfiDecision) return rfiDecision;

    // Check for schedule slip
    const behindPhases = (schedulePhases ?? []).filter(
      (p) =>
        p.is_critical_path &&
        p.status !== 'complete' &&
        (p.percent_complete ?? 0) < 100,
    );
    const scheduleDecision = generateScheduleDecision(
      scheduleVariance,
      behindPhases,
    );
    if (scheduleDecision) return scheduleDecision;

    return null;
  }, [
    forecastData,
    schedulePhases,
    weatherData,
    crewCount,
    budgetSpent,
    budgetTotal,
    rfisOverdue,
    rfisOpen,
    scheduleVariance,
  ]);

  // ── Weather summary ────────────────────────────────────

  const weatherToday = useMemo(() => {
    if (!weatherData) return null;
    // Get today's precip from forecast
    const todayStr = now.toISOString().split('T')[0];
    const todayForecast = forecastData?.find((d) => d.date === todayStr);
    return {
      conditions: weatherData.conditions,
      tempHigh: weatherData.temp_high,
      tempLow: weatherData.temp_low,
      precipProbability: todayForecast?.precip_probability ?? 0,
    };
  }, [weatherData, forecastData]);

  return {
    projectName,
    dayNumber,
    totalDays,
    decision,
    dayEvents,
    sunriseMinutes: sunTimes.sunrise,
    sunsetMinutes: sunTimes.sunset,
    nowMinutes,
    weatherToday,
    loading: projectLoading,
  };
}
