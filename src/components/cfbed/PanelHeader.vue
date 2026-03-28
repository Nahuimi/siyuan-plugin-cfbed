<template>
  <header class="cfbed-topbar">
    <div class="cfbed-topbar__main">
      <div class="cfbed-topbar__eyebrow">{{ t('panel.header.brand', 'CloudFlare ImgBed') }}</div>
      <div class="cfbed-topbar__title">{{ currentDocTitle || t('common.currentDocMissing', '未定位到当前笔记') }}</div>
      <div class="cfbed-topbar__desc">{{ t('panel.header.desc', '按思源当前文档上下文扫描图片，并统一完成上传、替换和迁移记录。') }}</div>
    </div>

    <div class="cfbed-topbar__side">
      <div class="cfbed-topbar__controls">
        <SySelect
          class="topbar-select"
          :model-value="activeConfigId"
          :options="configOptions"
          @update:modelValue="$emit('update:active-config', $event)"
        />

        <button
          class="toggle-chip"
          :class="{ 'toggle-chip--active': autoReplace }"
          @click="$emit('toggle-auto-replace')"
        >
          {{ autoReplace ? t('panel.header.autoReplaceOn', '自动替换已开启') : t('panel.header.autoReplaceOff', '自动替换已关闭') }}
        </button>

        <button class="theme-switch" :title="themeButtonTitle" @click="$emit('cycle-theme')">
          <span class="theme-switch__icon" aria-hidden="true">{{ themeModeIcon }}</span>
          <span class="theme-switch__text">{{ themeModeLabel }}</span>
        </button>

        <button class="header-btn close-btn" @click="$emit('close')">{{ t('common.close', '关闭') }}</button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import { useI18n } from '@/utils/i18n'

defineProps<{
  currentDocTitle: string
  activeConfigId: string
  autoReplace: boolean
  themeButtonTitle: string
  themeModeIcon: string
  themeModeLabel: string
  configOptions: Array<{ value: string | number, text: string }>
}>()

defineEmits<{
  (e: 'update:active-config', value: string): void
  (e: 'toggle-auto-replace'): void
  (e: 'cycle-theme'): void
  (e: 'close'): void
}>()

const { t } = useI18n()
</script>
