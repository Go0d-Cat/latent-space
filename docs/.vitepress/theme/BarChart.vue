<script setup lang="ts">
/**
 * 无依赖的横向条形图，颜色取自 VitePress 主题变量，自动适配各站点主题和深色模式。
 * 在文章里按需引入：import BarChart from '../.vitepress/theme/BarChart.vue'
 * - series 有多项时每行是堆叠条，values 与 series 一一对应；只有一项时用 highlight 区分重点行。
 */
import { computed } from 'vue'

interface Series {
  label: string
  color?: string
}
interface Row {
  label: string
  values: number[]
  /** 行尾文字，默认显示各段之和 */
  end?: string
  highlight?: boolean
}
interface Group {
  label?: string
  rows: Row[]
}

const props = withDefaults(
  defineProps<{
    title?: string
    caption?: string
    series: Series[]
    groups: Group[]
    max?: number
    unit?: string
    digits?: number
    /** 段宽足够时在段内显示数值 */
    segmentLabels?: boolean
    refLine?: { value: number; label: string }
  }>(),
  { unit: '', digits: 0, segmentLabels: false }
)

const PALETTE = ['var(--vp-c-indigo-2)', 'var(--vp-c-green-2)', 'var(--vp-c-yellow-2)', 'var(--vp-c-purple-2)', 'var(--vp-c-red-2)']
const HIGHLIGHT = 'var(--vp-c-brand-2)'
const NEUTRAL = 'color-mix(in srgb, var(--vp-c-text-2) 40%, transparent)'

const stacked = computed(() => props.series.length > 1)
const scaleMax = computed(() => {
  const sums = props.groups.flatMap((g) => g.rows.map((r) => r.values.reduce((a, b) => a + b, 0)))
  return props.max ?? Math.max(...sums, props.refLine?.value ?? 0)
})

function fmt(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: props.digits, maximumFractionDigits: props.digits }) + props.unit
}
function pct(v: number): number {
  return scaleMax.value > 0 ? (v / scaleMax.value) * 100 : 0
}
function color(row: Row, i: number): string {
  if (stacked.value) return props.series[i]?.color ?? PALETTE[i % PALETTE.length]
  return row.highlight ? HIGHLIGHT : (props.series[0]?.color ?? NEUTRAL)
}
</script>

<template>
  <figure class="bar-chart">
    <div v-if="title" class="bc-title">{{ title }}</div>
    <div v-if="stacked || refLine" class="bc-legend">
      <template v-if="stacked">
        <span v-for="(s, i) in series" :key="s.label" class="bc-legend-item">
          <i :style="{ background: s.color ?? PALETTE[i % PALETTE.length] }" />{{ s.label }}
        </span>
      </template>
      <span v-if="refLine" class="bc-legend-item"><i class="bc-legend-ref" />{{ refLine.label }}</span>
    </div>
    <div class="bc-body">
      <template v-for="(g, gi) in groups" :key="gi">
        <div v-if="g.label" class="bc-group">{{ g.label }}</div>
        <div v-for="r in g.rows" :key="r.label" class="bc-row" :class="{ 'is-highlight': r.highlight }">
          <div class="bc-label">{{ r.label }}</div>
          <div class="bc-track">
            <div
              v-for="(v, i) in r.values"
              :key="i"
              class="bc-seg"
              :style="{ width: pct(v) + '%', background: color(r, i) }"
              :title="(stacked ? series[i].label + '：' : '') + fmt(v)"
            >
              <span v-if="segmentLabels && pct(v) >= 14">{{ fmt(v) }}</span>
            </div>
            <div v-if="refLine" class="bc-ref" :style="{ left: pct(refLine.value) + '%' }" />
          </div>
          <div class="bc-end">{{ r.end ?? fmt(r.values.reduce((a, b) => a + b, 0)) }}</div>
        </div>
      </template>
    </div>
    <figcaption v-if="caption" class="bc-caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.bar-chart {
  margin: 20px 0;
  padding: 16px 18px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  line-height: 1.4;
}
.bc-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--vp-c-text-1);
  margin-bottom: 8px;
}
.bc-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-bottom: 10px;
  color: var(--vp-c-text-2);
}
.bc-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.bc-legend-item i {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
.bc-legend-item i.bc-legend-ref {
  width: 0;
  height: 14px;
  border-radius: 0;
  border-left: 2px dashed var(--vp-c-text-2);
}
.bc-body {
  display: grid;
  grid-template-columns: minmax(5.5em, max-content) 1fr max-content;
  gap: 6px 10px;
  align-items: center;
}
.bc-group {
  grid-column: 1 / -1;
  margin-top: 6px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.bc-row {
  display: contents;
}
.bc-label {
  color: var(--vp-c-text-2);
  white-space: nowrap;
}
.bc-row.is-highlight .bc-label,
.bc-row.is-highlight .bc-end {
  color: var(--vp-c-text-1);
  font-weight: 600;
}
.bc-track {
  position: relative;
  display: flex;
  height: 18px;
  border-radius: 4px;
  background: var(--vp-c-default-soft);
  overflow: hidden;
}
.bc-seg {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: #fff;
  font-size: 11px;
  white-space: nowrap;
}
.bc-seg + .bc-seg {
  box-shadow: inset 1px 0 0 var(--vp-c-bg-soft);
}
.bc-ref {
  position: absolute;
  top: -3px;
  bottom: -3px;
  border-left: 2px dashed var(--vp-c-text-2);
}
.bc-end {
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.bc-caption {
  margin-top: 10px;
  color: var(--vp-c-text-3);
  font-size: 12px;
}
@media (max-width: 640px) {
  .bar-chart {
    padding: 12px;
    font-size: 12px;
  }
  .bc-body {
    gap: 5px 8px;
  }
}
</style>
