<script setup lang="ts">
import { computed } from 'vue'
import { useData, useRouter, withBase } from 'vitepress'
import NavSelect from './NavSelect.vue'
import { localePrefix, routeOf, uiLang, uiText, type SiteThemeConfig } from './i18n.ts'

defineProps<{ screen?: boolean }>()

const { site, localeIndex, page, theme, lang } = useData<SiteThemeConfig>()
const router = useRouter()

const options = computed(() =>
  Object.entries(site.value.locales).map(([key, l]) => ({ value: key, label: l.label ?? key }))
)

/**
 * 切换语言时优先跳到另一种语言的同一页面；
 * 该页面还没有对应翻译时，回到目标语言的首页，避免落到 404。
 */
function onChange(key: string) {
  if (key === localeIndex.value) return
  const from = localePrefix(localeIndex.value)
  const rel = page.value.relativePath
  const rest = rel && rel.startsWith(from) ? rel.slice(from.length) : ''
  const candidate = rest ? routeOf(localePrefix(key) + rest) : ''
  const target = candidate && theme.value.pages?.includes(candidate) ? candidate : `/${localePrefix(key)}`
  router.go(withBase(target))
}
</script>

<template>
  <NavSelect
    :label="uiText[uiLang(lang)].language"
    :options="options"
    :model-value="localeIndex"
    :screen="screen"
    @update:model-value="onChange"
  />
</template>
