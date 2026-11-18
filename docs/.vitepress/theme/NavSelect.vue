<script setup lang="ts">
// 导航栏里的下拉选择框，主题切换和语言切换共用
defineProps<{
  label: string
  options: { value: string; label: string }[]
  modelValue: string
  /** 是否渲染在移动端菜单里 */
  screen?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLSelectElement).value)
}
</script>

<template>
  <label class="ls-switcher" :class="{ screen }">
    <span class="label">{{ label }}</span>
    <select :value="modelValue" @change="onChange">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </label>
</template>

<style scoped>
.ls-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: 16px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

/* 桌面导航栏里的切换器在窄屏隐藏，窄屏用菜单里的那一组 */
@media (max-width: 767px) {
  .ls-switcher:not(.screen) {
    display: none;
  }
}

.ls-switcher.screen {
  justify-content: space-between;
  margin: 24px 0 0;
  padding: 12px 14px;
  border-radius: 8px;
  background-color: var(--vp-c-bg-soft);
}

.ls-switcher.screen + .ls-switcher.screen {
  margin-top: 12px;
}

select {
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font: inherit;
  cursor: pointer;
  transition: border-color 0.2s ease-out, background-color 0.2s ease-out;
}

select:hover {
  border-color: var(--vp-c-brand-1);
}

select:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
</style>
