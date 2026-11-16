// Hand-built SVG charts. Colours come from theme variables; widths follow the container.
export { BarChart, type BarChartProps, type BarDatum } from './BarChart';
export { Donut, type DonutProps } from './Donut';
export { DualBar, type DualBarProps, type DualBarRow } from './DualBar';
export { fmt, estimateTextWidth, fitLabel } from './format';
export { Legend, type LegendItem, type LegendProps } from './Legend';
export { CHART_AXIS, CHART_COLORS, CHART_GRID, chartColor, ragSegments, type Segment } from './palette';
export { Sparkline, type SparklineProps } from './Sparkline';
export { StackedBar, type StackedBarProps } from './StackedBar';
export { useElementSize } from './useElementSize';
