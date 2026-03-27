<template>
  <div class="toolbar-row wrap toolbar-row--panel log-filter-bar">
    <SyButton
      v-for="item in options"
      :key="item.value"
      class="header-btn log-filter-bar__btn"
      :class="{ 'header-btn--active': modelValue === item.value }"
      @click="$emit('update:modelValue', item.value)"
    >
      {{ item.label }}
    </SyButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import type { UploadLogFilter } from '@/types/plugin'
import { useI18n } from '@/utils/i18n'

defineProps<{
  modelValue: UploadLogFilter
}>()

defineEmits<{
  (e: 'update:modelValue', value: UploadLogFilter): void
}>()

const { t } = useI18n()

const options = computed<Array<{ label: string, value: UploadLogFilter }>>(() => [
  { label: t('log.all', '全部'), value: 'all' },
  { label: t('log.info', '信息'), value: 'info' },
  { label: t('log.success', '成功'), value: 'success' },
  { label: t('log.error', '失败'), value: 'error' },
])
</script>
