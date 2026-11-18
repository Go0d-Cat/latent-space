<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useData } from 'vitepress'
import NavSelect from './NavSelect.vue'
import { themes, isThemeId } from './themes.ts'
import { uiLang, uiText } from './i18n.ts'
import { useSiteTheme } from './useSiteTheme.ts'

defineProps<{ screen?: boolean }>()

const { lang } = useData()
const { current, sync, setTheme } = useSiteTheme()

const ui = computed(() => uiLang(lang.value))
const options = computed(() => themes.map((t) => ({ value: t.id, label: t.name[ui.value] })))

onMounted(sync)

function onChange(value: string) {
  if (isThemeId(value)) setTheme(value)
}
</script>

<template>
  <NavSelect
    :label="uiText[ui].theme"
    :options="options"
    :model-value="current"
    :screen="screen"
    @update:model-value="onChange"
  />
</template>
