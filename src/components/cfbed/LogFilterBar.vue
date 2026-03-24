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
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import type { UploadLogFilter } from '@/types/plugin'

defineProps<{
  modelValue: UploadLogFilter
}>()

defineEmits<{
  (e: 'update:modelValue', value: UploadLogFilter): void
}>()

const options: Array<{ label: string, value: UploadLogFilter }> = [
  { label: '全部', value: 'all' },
  { label: '信息', value: 'info' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'error' },
]
</script>
