import { useMemo, useRef, useState } from 'react';
import { addMonths, format, getYear, isValid, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import { getFieldOptionItems, pillDisplayForField } from '@/lib/fieldOptions';
import { notionColorFillHex, normalizeNotionColor } from '@/lib/notionColors';
import {
  countBySource,
  sumAmount,
  sumBySource,
  upcomingBookingsInCalendarYear,
} from '@/lib/dashboardStats';
import { filterByCalendarYear, filterByMonth } from '@/lib/bookingUtils';
import { formatDateRu, formatOrderCountRu, formatRub } from '@/lib/format';

/** Подпись деления оси Y (руб.) */
function axisRubLabel(n) {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10} млн`;
  if (n >= 1000) return `${Math.round(n / 1000)} тыс`;
  return String(Math.round(n));
}

/** Короткая сумма над столбцом */
function barTopLabel(sum) {
  if (sum <= 0) return '—';
  if (sum >= 1000) return `${Math.round(sum / 1000)}k`;
  return formatRub(sum);
}

/** Высота поля гистограммы (px) — общая для оси Y и области столбцов */
const PLOT_H = 200;

/**
 * Сектор кольца (donut).
 * @param {object} p
 * @param {number} p.cx
 * @param {number} p.cy
 * @param {number} p.r0 outer
 * @param {number} p.r1 inner
 * @param {number} p.startAngle rad
 * @param {number} p.endAngle rad
 */
function donutSegmentPath({ cx, cy, r0, r1, startAngle, endAngle }) {
  const x1 = cx + r0 * Math.cos(startAngle);
  const y1 = cy + r0 * Math.sin(startAngle);
  const x2 = cx + r0 * Math.cos(endAngle);
  const y2 = cy + r0 * Math.sin(endAngle);
  const x3 = cx + r1 * Math.cos(endAngle);
  const y3 = cy + r1 * Math.sin(endAngle);
  const x4 = cx + r1 * Math.cos(startAngle);
  const y4 = cy + r1 * Math.sin(startAngle);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > Math.PI ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${r0} ${r0} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${r1} ${r1} 0 ${largeArc} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

function sourceCountWordRu(n) {
  const c = Math.abs(Math.trunc(Number(n) || 0));
  const m100 = c % 100;
  const m10 = c % 10;
  if (m100 >= 11 && m100 <= 14) return 'источников';
  if (m10 === 1) return 'источник';
  if (m10 >= 2 && m10 <= 4) return 'источника';
  return 'источников';
}

/** Доля по источникам: кольцо, в центре лидер по выручке, подсказка при наведении на сектор, компактная легенда. */
function SourceRevenueDonut({ sources, segments, totalSum }) {
  const chartWrapRef = useRef(null);
  const [sliceTip, setSliceTip] = useState(null);
  const bestSeg = useMemo(() => {
    if (!segments.length) return null;
    return segments.reduce((a, b) => (b.sum > a.sum ? b : a));
  }, [segments]);

  const cx = 50;
  const cy = 50;
  /** Меньше внешний радиус + шире отверстие — тонкое цветное кольцо, больше места под хаб */
  const r0 = 39;
  const r1 = 32;
  const rMid = (r0 + r1) / 2;
  const strokeRing = r0 - r1;
  const gapRad = 0.056;
  const startBase = -Math.PI / 2;
  const n = segments.length;
  const gapBetween = n > 1 ? gapRad : 0;
  const available = 2 * Math.PI - n * gapBetween;

  const bestRow = bestSeg ? sources.find((s) => s.id === bestSeg.id) : null;
  const bestLabel = bestRow?.label ?? bestSeg?.id ?? '';

  let angle = startBase;
  const slices = segments.map((seg) => {
    const row = sources.find((s) => s.id === seg.id);
    const label = row?.label ?? seg.id;
    const fill = row?.fillHex ?? notionColorFillHex('gray');
    const frac = totalSum > 0 ? seg.sum / totalSum : 0;
    const sweep = frac * available;
    const startA = angle;
    const endA = angle + sweep;
    angle = endA + gapBetween;
    const d =
      sweep > 0.0001 && frac > 0
        ? donutSegmentPath({ cx, cy, r0, r1, startAngle: startA, endAngle: endA })
        : '';
    return { id: seg.id, d, fill, seg, label };
  });

  const hasSlice = slices.some((s) => s.d);
  const singleFull = segments.length === 1 && totalSum > 0;
  const singleStroke =
    sources.find((s) => s.id === segments[0]?.id)?.fillHex ?? notionColorFillHex('gray');

  const ariaLabel =
    totalSum > 0
      ? `Доля выручки по источникам. Всего ${formatRub(totalSum)}. ${segments
          .map((seg) => {
            const src = sources.find((s) => s.id === seg.id);
            return `${src?.label ?? seg.id}: ${seg.pct.toFixed(1)}%, ${formatRub(seg.sum)}, ${formatOrderCountRu(seg.count)}`;
          })
          .join('. ')}`
      : 'Доля выручки по источникам — нет данных';

  /** Совпадает с внутренним радиусом r1 в viewBox 0…100: иначе хаб перекрывает кольцо */
  const hubInsetPct = `${(50 - r1).toFixed(2)}%`;

  const setTipFromEvent = (e, sl) => {
    const root = chartWrapRef.current;
    if (!root) return;
    const r = root.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const pad = 8;
    const tx = Math.min(Math.max(x, pad), r.width - pad);
    const ty = Math.min(Math.max(y, pad), r.height - pad);
    setSliceTip({
      id: sl.id,
      label: sl.label,
      pct: sl.seg.pct,
      sum: sl.seg.sum,
      count: sl.seg.count,
      x: tx,
      y: ty,
    });
  };

  return (
    <div className="flex w-full flex-col items-stretch gap-4" role="img" aria-label={ariaLabel}>
      <div
        ref={chartWrapRef}
        className="relative mx-auto aspect-square w-full max-w-[min(100%,15rem)] sm:max-w-[min(100%,16.5rem)]"
      >
        <div className="relative size-full">
          <svg viewBox="0 0 100 100" className="size-full" aria-hidden>
            <title>Выручка по источникам</title>
            {n === 0 || (!singleFull && !hasSlice) ? (
              <circle
                cx={cx}
                cy={cy}
                r={rMid}
                fill="none"
                stroke="currentColor"
                className="text-notion-border"
                strokeOpacity={0.45}
                strokeWidth={strokeRing + 0.75}
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <>
                <circle
                  cx={cx}
                  cy={cy}
                  r={rMid}
                  fill="none"
                  stroke="currentColor"
                  className="text-notion-border"
                  strokeOpacity={0.2}
                  strokeWidth={strokeRing + 1.25}
                  vectorEffect="non-scaling-stroke"
                />
                {singleFull ? (
                  <g>
                    <title>
                      {`${sources.find((s) => s.id === segments[0].id)?.label ?? segments[0].id}: 100% · ${formatRub(segments[0].sum)} · ${formatOrderCountRu(segments[0].count)}`}
                    </title>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={rMid}
                      fill="none"
                      stroke={singleStroke}
                      strokeWidth={strokeRing}
                      strokeLinecap="round"
                      className="cursor-default transition-opacity hover:opacity-90"
                      onPointerEnter={(e) =>
                        setTipFromEvent(e, {
                          id: segments[0].id,
                          label: sources.find((s) => s.id === segments[0].id)?.label ?? segments[0].id,
                          seg: segments[0],
                        })
                      }
                      onPointerMove={(e) =>
                        setTipFromEvent(e, {
                          id: segments[0].id,
                          label: sources.find((s) => s.id === segments[0].id)?.label ?? segments[0].id,
                          seg: segments[0],
                        })
                      }
                      onPointerLeave={() => setSliceTip(null)}
                    />
                  </g>
                ) : (
                  slices.map((sl) =>
                    sl.d ? (
                      <path
                        key={sl.id}
                        d={sl.d}
                        fill={sl.fill}
                        stroke="#191919"
                        strokeOpacity={0.92}
                        strokeWidth={1.05}
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        className="cursor-pointer transition-[opacity,filter] hover:opacity-95 hover:brightness-110"
                        onPointerEnter={(e) => setTipFromEvent(e, sl)}
                        onPointerMove={(e) => setTipFromEvent(e, sl)}
                        onPointerLeave={() => setSliceTip(null)}
                      >
                        <title>
                          {`${sl.label}: ${sl.seg.pct.toFixed(1)}% · ${formatRub(sl.seg.sum)} · ${formatOrderCountRu(sl.seg.count)}`}
                        </title>
                      </path>
                    ) : null,
                  )
                )}
              </>
            )}
          </svg>

          {n > 0 && (singleFull || hasSlice) && bestSeg ? (
            <div
              className="pointer-events-none absolute z-[1] flex flex-col items-center justify-center rounded-full bg-notion-surface px-2 text-center ring-1 ring-notion-border/70"
              style={{ inset: hubInsetPct }}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-notion-muted">лучший</span>
              <span className="mt-1 line-clamp-2 max-w-[96%] text-center text-sm font-semibold leading-snug text-white sm:text-base">
                {singleFull ? sources.find((s) => s.id === segments[0].id)?.label ?? segments[0].id : bestLabel}
              </span>
              <span className="mt-1 text-lg font-bold tabular-nums text-white sm:text-xl">
                {singleFull ? '100%' : `${bestSeg.pct.toFixed(1)}%`}
              </span>
              <span className="mt-1 max-w-[96%] truncate text-xs tabular-nums text-notion-muted sm:text-sm">
                {formatRub(singleFull ? segments[0].sum : bestSeg.sum)}
              </span>
            </div>
          ) : null}

          {sliceTip ? (
            <div
              className="pointer-events-none absolute z-[2] w-56 rounded-xl border border-notion-border bg-notion-surface px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-black/60"
              style={{
                left: sliceTip.x,
                top: sliceTip.y,
                transform: 'translate(-50%, calc(-100% - 12px))',
              }}
            >
              <p className="line-clamp-3 text-sm font-semibold leading-tight text-white break-words">
                {sliceTip.label}
              </p>
              <p className="mt-1 text-xs leading-tight tabular-nums text-notion-muted">
                <span className="font-semibold text-white">{sliceTip.pct.toFixed(1)}%</span>
                <span className="text-notion-muted/55"> · </span>
                {formatRub(sliceTip.sum)}
                <span className="text-notion-muted/55"> · </span>
                {formatOrderCountRu(sliceTip.count)}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <ul className="grid min-w-0 w-full grid-cols-3 gap-1.5 sm:gap-2">
        {segments.map((seg) => {
          const src = sources.find((s) => s.id === seg.id);
          const fill = src?.fillHex ?? notionColorFillHex('gray');
          return (
            <li
              key={seg.id}
              className="flex min-h-0 min-w-0 items-center gap-1.5 rounded-lg border border-notion-border/50 bg-notion-bg/30 px-1.5 py-1.5 sm:gap-2 sm:px-2"
            >
              <span
                className="size-2 shrink-0 rounded-full ring-1 ring-white/12"
                style={{ backgroundColor: fill }}
                aria-hidden
              />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-white/95 sm:text-xs">{src?.label ?? seg.id}</span>
                  <span className="shrink-0 text-[10px] font-semibold tabular-nums text-notion-muted sm:text-[11px]">
                    {seg.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[10px] tabular-nums text-notion-muted/90">
                  {formatRub(seg.sum)}
                  <span className="text-notion-muted/40"> · </span>
                  {formatOrderCountRu(seg.count)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function KpiCard({ title, value, hint, accent }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-notion-border bg-notion-surface p-4 sm:p-5 shadow-sm ${accent}`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-notion-muted">{title}</div>
      <div className="mt-2 text-2xl sm:text-3xl font-semibold text-white tabular-nums tracking-tight">
        {value}
      </div>
      {hint ? <div className="mt-1.5 text-xs text-notion-muted">{hint}</div> : null}
    </div>
  );
}

/**
 * @param {object} props
 * @param {ReturnType<import('@/lib/bookingUtils').normalizeBooking>[]} props.bookings
 * @param {Date} props.monthCursor
 * @param {any[] | undefined} props.fields
 * @param {(id: string) => void} props.onOpenBooking
 * @param {'month' | 'year' | 'all'} [props.dashboardPeriod]
 */
export function DashboardView({ bookings, monthCursor, fields, onOpenBooking, dashboardPeriod = 'month' }) {
  const stats = useMemo(() => {
    const calendarYear = getYear(monthCursor);
    const chartYear = dashboardPeriod === 'all' ? getYear(new Date()) : calendarYear;

    let reportList;
    if (dashboardPeriod === 'month') {
      reportList = filterByMonth(bookings, monthCursor);
    } else if (dashboardPeriod === 'year') {
      reportList = filterByCalendarYear(bookings, calendarYear);
    } else {
      reportList = bookings.filter((b) => {
        const raw = typeof b?.date === 'string' ? b.date.trim() : '';
        if (!raw) return false;
        const d = parseISO(raw);
        return isValid(d);
      });
    }

    const reportSum = sumAmount(reportList);
    const avgCheck = reportList.length ? reportSum / reportList.length : 0;

    let prevSum = 0;
    let delta = 0;
    /** @type {boolean} */
    let showCompare = false;
    /** @type {string} */
    let comparePrefix = '';

    if (dashboardPeriod === 'month') {
      const prevMonth = addMonths(monthCursor, -1);
      const prevList = filterByMonth(bookings, prevMonth);
      prevSum = sumAmount(prevList);
      delta = prevSum > 0 ? ((reportSum - prevSum) / prevSum) * 100 : reportSum > 0 ? 100 : 0;
      showCompare = true;
      comparePrefix = 'к прошлому месяцу';
    } else if (dashboardPeriod === 'year') {
      const prevList = filterByCalendarYear(bookings, calendarYear - 1);
      prevSum = sumAmount(prevList);
      delta = prevSum > 0 ? ((reportSum - prevSum) / prevSum) * 100 : reportSum > 0 ? 100 : 0;
      showCompare = true;
      comparePrefix = 'к прошлому году';
    }

    const processingInPeriod = reportList
      .filter((b) => b.status === 'processing')
      .sort((a, b) => a.date.localeCompare(b.date));

    const sourceCounts = countBySource(reportList);
    const sourceSums = sumBySource(reportList);
    const upcoming = upcomingBookingsInCalendarYear(bookings, fields);

    const yearListForChart = filterByCalendarYear(bookings, chartYear);
    const yearListCalendar = filterByCalendarYear(bookings, calendarYear);
    const yearSumCalendar = sumAmount(yearListCalendar);

    const datedBookings = bookings.filter((b) => {
      const raw = typeof b?.date === 'string' ? b.date.trim() : '';
      if (!raw) return false;
      return isValid(parseISO(raw));
    });
    const allTimeSum = sumAmount(datedBookings);
    const nowY = getYear(new Date());
    const currentYearList = filterByCalendarYear(bookings, nowY);
    const currentYearSum = sumAmount(currentYearList);

    // Календарный год для графика: Янв → Дек
    const yearMo = Array.from({ length: 12 }, (_, i) => {
      const month = new Date(chartYear, i, 1);
      return { month, sum: 0, count: 0 };
    });
    for (const b of yearListForChart) {
      if (!b?.date) continue;
      const m = parseISO(b.date).getMonth();
      if (m < 0 || m > 11) continue;
      yearMo[m].sum += Number(b.amount) || 0;
      yearMo[m].count += 1;
    }
    const yearTotal = yearMo.reduce((acc, x) => acc + x.sum, 0);
    const yearMax = Math.max(...yearMo.map((x) => x.sum), 0);
    const maxBar = Math.max(yearMax, 1);

    const sourceIdKeys = Object.keys(sourceSums).filter((id) => (sourceSums[id] || 0) > 0);
    const totalSourceRev = sourceIdKeys.reduce((acc, id) => acc + (sourceSums[id] || 0), 0);
    const sourcePieSegments = sourceIdKeys
      .map((id) => {
        const sum = sourceSums[id] || 0;
        const count = sourceCounts[id] || 0;
        return {
          id,
          sum,
          count,
          pct: totalSourceRev > 0 ? (sum / totalSourceRev) * 100 : 0,
        };
      })
      .sort((a, b) => b.sum - a.sum);

    const sourceField = fields?.find((f) => f.key === 'sourceId' || f.type === 'source');
    const sourceOptionItems = sourceField ? getFieldOptionItems(sourceField) : [];
    const sourceRowsForPie = sourcePieSegments.map((seg) => {
      const p = pillDisplayForField(fields, 'sourceId', seg.id);
      const opt = sourceOptionItems.find((x) => x.id === seg.id);
      const colorKey = normalizeNotionColor(opt?.color);
      return {
        id: seg.id,
        label: p.label,
        className: p.className,
        fillHex: notionColorFillHex(colorKey),
      };
    });

    /** Четвёртая KPI: контрастный период */
    let kpi4Title = 'В календарном году';
    let kpi4Value = formatRub(yearSumCalendar);
    let kpi4Hint = `${yearListCalendar.length} записей за ${calendarYear} год`;
    if (dashboardPeriod === 'year') {
      kpi4Title = 'За всё время';
      kpi4Value = formatRub(allTimeSum);
      kpi4Hint = `${datedBookings.length} записей всего`;
    } else if (dashboardPeriod === 'all') {
      kpi4Title = `За ${nowY} год`;
      kpi4Value = formatRub(currentYearSum);
      kpi4Hint = `${currentYearList.length} записей с датой в ${nowY}`;
    }

    let primaryKpiTitle = 'Выручка за месяц';
    if (dashboardPeriod === 'year') primaryKpiTitle = 'Выручка за год';
    if (dashboardPeriod === 'all') primaryKpiTitle = 'Выручка за всё время';

    return {
      reportList,
      reportSum,
      prevSum,
      delta,
      showCompare,
      comparePrefix,
      processingInPeriod,
      sourceCounts,
      sourceSums,
      totalSourceRev,
      sourcePieSegments,
      sourceRowsForPie,
      yearMo,
      yearTotal,
      yearMax,
      maxBar,
      upcoming,
      calendarYear,
      chartYear,
      yearListForChart,
      avgCheck,
      kpi4Title,
      kpi4Value,
      kpi4Hint,
      primaryKpiTitle,
      allTimeSum,
    };
  }, [bookings, monthCursor, fields, dashboardPeriod]);

  const monthTitle = format(monthCursor, 'LLLL yyyy', { locale: ru });
  const yearTitle = format(monthCursor, 'yyyy', { locale: ru });
  const heroTitle =
    dashboardPeriod === 'month'
      ? `Сводка за ${monthTitle}`
      : dashboardPeriod === 'year'
        ? `Сводка за ${yearTitle} год`
        : 'Сводка за всё время';
  const heroBlurb =
    dashboardPeriod === 'month'
      ? 'Выручка, записи и источники за выбранный месяц. Период и месяц меняются в панели «Период» в шапке.'
      : dashboardPeriod === 'year'
        ? 'Показаны все записи с датой в выбранном календарном году. Переключите год в той же панели.'
        : 'Показаны все записи с датой съёмки. График ниже — по месяцам текущего календарного года.';

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto">
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-notion-surface to-notion-bg p-5 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-widest text-violet-300/80">Отчёты</p>
        <h1
          className={`mt-1 text-2xl sm:text-3xl font-semibold text-white ${
            dashboardPeriod === 'month' ? 'capitalize' : ''
          }`}
        >
          {heroTitle}
        </h1>
        <p className="mt-2 text-sm text-notion-muted max-w-xl">{heroBlurb}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title={stats.primaryKpiTitle}
          value={formatRub(stats.reportSum)}
          hint={
            stats.showCompare ? (
              stats.prevSum > 0 ? (
                <span className="inline-flex items-center gap-1">
                  {stats.delta >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  {stats.comparePrefix}: {stats.delta >= 0 ? '+' : ''}
                  {stats.delta.toFixed(0)}%
                </span>
              ) : (
                `Нет данных за прошлый ${dashboardPeriod === 'year' ? 'год' : 'месяц'} для сравнения`
              )
            ) : null
          }
          accent="ring-1 ring-emerald-500/10"
        />
        <KpiCard
          title="Всего записей"
          value={String(stats.reportList.length)}
          hint={`Средний чек ${formatRub(Math.round(stats.avgCheck))}`}
          accent="ring-1 ring-sky-500/10"
        />
        <KpiCard
          title="Предстоящие записи"
          value={String(stats.upcoming.length)}
          hint="До конца года · Записан и Переговоры"
          accent="ring-1 ring-amber-500/10"
        />
        <KpiCard
          title={stats.kpi4Title}
          value={stats.kpi4Value}
          hint={stats.kpi4Hint}
          accent="ring-1 ring-violet-500/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="rounded-2xl border border-notion-border bg-notion-surface p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">Проекты в обработке</h2>
              <p className="text-xs text-notion-muted mt-0.5 leading-relaxed">
                Только записи со статусом «Обрабатывается» за выбранный период
              </p>
            </div>
            <div
              className="shrink-0 flex items-center justify-center rounded-lg border border-notion-border/70 bg-notion-bg/40 px-2.5 py-1.5 min-w-[2.75rem]"
              title="Заказов в статусе «Обрабатывается» в выбранном периоде"
            >
              <span className="text-lg font-semibold tabular-nums text-white/90 leading-none">
                {stats.processingInPeriod.length}
              </span>
            </div>
          </div>
          {stats.reportList.length === 0 ? (
            <p className="text-sm text-notion-muted py-6 text-center rounded-xl bg-notion-bg/50 border border-dashed border-notion-border">
              Нет записей за этот период
            </p>
          ) : stats.processingInPeriod.length === 0 ? (
            <p className="text-sm text-notion-muted py-6 text-center rounded-xl bg-notion-bg/50 border border-dashed border-notion-border">
              Нет записей в статусе «Обрабатывается» за этот период
            </p>
          ) : (
            <ul className="space-y-2 max-h-[min(320px,50vh)] overflow-y-auto pr-0.5">
              {stats.processingInPeriod.map((b) => {
                const st = pillDisplayForField(fields, 'status', b.status);
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => onOpenBooking(b.id)}
                      className="w-full text-left rounded-xl border border-notion-border/70 bg-notion-bg/50 px-3 py-2.5 hover:bg-notion-hover/45 transition-colors touch-manipulation"
                    >
                      <div className="font-medium text-white text-sm leading-snug line-clamp-2">
                        {b.title || 'Без названия'}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-[11px] sm:text-xs">
                        <span className="text-notion-muted tabular-nums">{formatDateRu(b.date)}</span>
                        {b.timeRange ? (
                          <span className="text-sky-200/85 tabular-nums font-medium">{b.timeRange}</span>
                        ) : null}
                        <span
                          className={`px-1.5 py-0.5 rounded-md leading-none ${st.className}`}
                        >
                          {st.label}
                        </span>
                        {b.amount ? (
                          <span className="text-emerald-200/90 tabular-nums ml-auto">{formatRub(b.amount)}</span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-notion-border bg-notion-surface p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-white">Источники</h2>
          <p className="text-xs text-notion-muted mt-0.5 mb-4 leading-relaxed">
            Доля выручки за период: в центре — лидер по сумме; наведите на сектор кольца, чтобы увидеть партнёра и долю.
            Ниже — компактный список источников.
          </p>
          {stats.reportList.length === 0 ? (
            <p className="text-sm text-notion-muted py-6 text-center rounded-xl bg-notion-bg/50 border border-dashed border-notion-border">
              Нет данных за период
            </p>
          ) : stats.sourcePieSegments.length === 0 ? (
            <p className="text-sm text-notion-muted py-6 text-center rounded-xl bg-notion-bg/50 border border-dashed border-notion-border">
              Нет выручки по источникам за период
            </p>
          ) : (
            <SourceRevenueDonut
              sources={stats.sourceRowsForPie}
              segments={stats.sourcePieSegments}
              totalSum={stats.totalSourceRev}
            />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-violet-500/15 bg-gradient-to-br from-notion-surface via-notion-surface to-violet-950/25 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-notion-border/60">
          <div>
            <p className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-violet-300/75">
              Динамика
            </p>
            <h2 className="mt-1 text-base sm:text-lg font-semibold text-white tracking-tight">
              Выручка по месяцам
            </h2>
            <p className="text-xs text-notion-muted mt-1 max-w-md">
              Календарный год {stats.chartYear}: с января по декабрь
            </p>
          </div>
          <div className="flex items-baseline justify-between sm:block sm:text-right gap-4 rounded-xl bg-notion-bg/50 border border-notion-border/80 px-4 py-3 sm:py-2 sm:px-0 sm:border-0 sm:bg-transparent">
            <div className="text-[10px] uppercase tracking-wide text-notion-muted sm:mb-0.5">За период</div>
            <div className="text-xl sm:text-2xl font-semibold tabular-nums text-white">
              {formatRub(stats.yearTotal)}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 pt-4">
          <div className="rounded-lg border border-notion-border/70 bg-notion-bg/40 p-3 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
              <span className="text-[11px] text-notion-muted">
                Столбец — месяц; сверху сумма (₽), внизу число записей
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-notion-muted">
                максимум {formatRub(stats.yearMax)}
              </span>
            </div>

            <div className="flex gap-2 sm:gap-3">
              <div
                className="flex w-11 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums leading-none text-notion-muted sm:w-14"
                style={{ height: PLOT_H }}
              >
                {[1, 0.75, 0.5, 0.25, 0].map((t) => (
                  <span key={t}>{axisRubLabel(stats.maxBar * t)}</span>
                ))}
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className="relative border-l border-notion-border/50 pl-1"
                  style={{ height: PLOT_H }}
                >
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-notion-border/40"
                      style={{ bottom: `${i * 25}%` }}
                    />
                  ))}

                  <div className="absolute inset-0 flex gap-0.5 px-0.5 sm:gap-1">
                    {stats.yearMo.map(({ month, sum, count }) => {
                      const safeMax = stats.maxBar;
                      const plotInner = PLOT_H - 22;
                      const barH = safeMax > 0 ? (sum / safeMax) * plotInner : 0;
                      const hPx = sum > 0 ? Math.max(barH, 3) : 0;
                      const mLabel = format(month, 'LLL', { locale: ru });
                      return (
                        <div
                          key={month.toISOString()}
                          className="flex h-full min-w-0 flex-1 flex-col"
                          title={
                            sum > 0
                              ? `${formatRub(sum)} · ${count} ${count === 1 ? 'запись' : 'записей'}`
                              : `${mLabel}: нет данных`
                          }
                        >
                          <div className="mb-1 shrink-0 text-center text-[9px] font-medium tabular-nums text-white/95 sm:text-[10px]">
                            {barTopLabel(sum)}
                          </div>
                          <div className="flex min-h-0 flex-1 flex-col justify-end">
                            <div
                              className="mx-auto w-[80%] max-w-[40px] rounded-t-sm border border-violet-500/40 bg-violet-600 shadow-sm transition-colors hover:bg-violet-500"
                              style={{ height: hPx }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-1 flex gap-0.5 border-t border-notion-border/45 pt-2 sm:gap-1">
                  {stats.yearMo.map(({ month, count }) => (
                    <div
                      key={`m-${month.toISOString()}`}
                      className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-center"
                    >
                      <span className="text-[9px] tabular-nums leading-none text-notion-muted/90 sm:text-[10px]">
                        {count > 0 ? `${count} з.` : '—'}
                      </span>
                      <span className="text-[9px] capitalize leading-tight text-notion-muted sm:text-[10px]">
                        {format(month, 'LLL', { locale: ru })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-notion-border bg-notion-surface p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Ближайшие съёмки</h2>
            <p className="text-xs text-notion-muted mt-0.5 leading-relaxed">
              От сегодня до конца {format(new Date(), 'yyyy')} года · статусы «Записан» и «Переговоры»
            </p>
          </div>
        </div>
        {stats.upcoming.length === 0 ? (
          <p className="text-sm text-notion-muted py-6 text-center border border-dashed border-notion-border rounded-xl">
            Нет подходящих записей до конца года
          </p>
        ) : (
          <ul className="max-h-[min(480px,60vh)] divide-y divide-notion-border overflow-y-auto rounded-xl border border-notion-border">
            {stats.upcoming.map((b) => {
              const st = pillDisplayForField(fields, 'status', b.status);
              const src = pillDisplayForField(fields, 'sourceId', b.sourceId);
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => onOpenBooking(b.id)}
                    className="w-full flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 text-left hover:bg-notion-hover/50 transition-colors touch-manipulation group"
                  >
                    <div className="shrink-0 text-center min-w-[3rem] sm:min-w-[3.5rem]">
                      <div className="text-xs text-notion-muted leading-tight">
                        {format(parseISO(b.date), 'd MMM', { locale: ru })}
                      </div>
                      <div className="text-[10px] text-notion-muted/70 capitalize">
                        {format(parseISO(b.date), 'EEE', { locale: ru })}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate group-hover:text-violet-200 transition-colors">
                        {b.title || 'Без названия'}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {b.timeRange ? (
                          <span className="text-xs text-sky-200/90 font-medium tabular-nums">{b.timeRange}</span>
                        ) : null}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${st.className}`}>{st.label}</span>
                        {src.label ? (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${src.className}`}>{src.label}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-emerald-200 tabular-nums">{formatRub(b.amount)}</div>
                      <ArrowRight className="w-4 h-4 text-notion-muted opacity-0 group-hover:opacity-100 transition-opacity ml-auto mt-1 hidden sm:block" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
