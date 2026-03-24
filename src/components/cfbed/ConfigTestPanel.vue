<template>
  <section class="section-card glass-card config-test-panel">
    <div class="section-head">
      <div>
        <div class="section-title">配置测试</div>
        <div class="section-desc">检测当前启用图床配置的基础可访问性。</div>
      </div>
      <div class="toolbar-row wrap">
        <SyButton class="ui-btn ui-btn--primary" :disabled="testing" @click="$emit('test')">
          {{ testing ? '测试中...' : '测试当前配置' }}
        </SyButton>
      </div>
    </div>

    <div
      v-if="result"
      class="config-test-result"
      :class="{ 'config-test-result--ok': result.ok, 'config-test-result--error': !result.ok }"
    >
      <div class="config-test-result__title">{{ result.ok ? '测试通过' : '测试失败' }}</div>
      <div class="config-test-result__message">{{ result.message }}</div>
      <pre v-if="result.detail" class="config-test-result__detail">{{ formatDetail(result.detail) }}</pre>
    </div>

    <div v-else class="minor-text">
      点击上方按钮，测试当前启用配置是否可访问。
    </div>
  </section>
</template>

<script setup lang="ts">
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import type { ConfigTestResult } from '@/types/plugin'

defineProps<{
  testing: boolean
  result: ConfigTestResult | null
}>()

defineEmits<{
  (e: 'test'): void
}>()

function formatDetail(detail: any) {
  try {
    return JSON.stringify(detail, null, 2)
  }
  catch {
    return String(detail)
  }
}
</script>
