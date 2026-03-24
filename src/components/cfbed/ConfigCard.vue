<template>
  <div class="config-card premium-card" :class="{ 'config-card--enabled': config.enabled }">
    <div class="config-head config-head--inline">
      <div class="config-head__summary config-head__summary--compact">
        <strong class="config-summary-line config-summary-line--name">{{ config.name || '未命名配置' }}</strong>
        <span class="config-summary-line config-summary-line--channel">{{ uploadChannelLabel(config.uploadChannel) }}</span>
        <span class="config-summary-line config-summary-line--host">{{ config.host || '未配置站点地址' }}</span>
      </div>

      <div class="config-head__actions">
        <button
          type="button"
          class="toggle-chip test-chip"
          :class="testChipClass"
          :disabled="testing"
          @click="handleTest"
        >
          {{ testChipText }}
        </button>
        <button
          type="button"
          class="toggle-chip"
          :class="{ 'toggle-chip--active': config.enabled }"
          @click="updateField('enabled', !config.enabled)"
        >
          {{ config.enabled ? '已启用' : '未启用' }}
        </button>
        <SyButton class="header-btn config-head__btn" @click="expanded = !expanded">
          {{ expanded ? '收起' : '展开' }}
        </SyButton>
        <SyButton class="ui-btn ui-btn--danger config-head__btn" @click="$emit('remove', config.id)">删除</SyButton>
      </div>
    </div>

    <div v-if="expanded" class="config-advanced">
      <div class="grid-two grid-two--loose">
        <label class="field field-row">
          <span class="field-row__label">名称</span>
          <SyInput class="field-row__control" :model-value="config.name" @update:modelValue="updateField('name', $event)" />
        </label>

        <label class="field field-row">
          <span class="field-row__label">站点地址</span>
          <SyInput class="field-row__control" :model-value="config.host" placeholder="https://img.example.com" @update:modelValue="updateField('host', $event)" />
        </label>

        <label class="field field-row">
          <span class="field-row__label">API 令牌</span>
          <SyInput class="field-row__control" :model-value="config.token" @update:modelValue="updateField('token', $event)" />
        </label>

        <label class="field field-row">
          <span class="field-row__label">上传认证码</span>
          <SyInput class="field-row__control" :model-value="config.authCode" @update:modelValue="updateField('authCode', $event)" />
        </label>

        <label class="field field-row">
          <span class="field-row__label">上传渠道</span>
          <SySelect class="field-row__control" :model-value="config.uploadChannel" :options="uploadChannelOptions" @update:modelValue="updateField('uploadChannel', $event)" />
        </label>

        <label class="field field-row">
          <span class="field-row__label">渠道名称</span>
          <SyInput class="field-row__control" :model-value="config.channelName" placeholder="可选" @update:modelValue="updateField('channelName', $event)" />
        </label>

        <label class="field field-row">
          <span class="field-row__label">上传目录</span>
          <SyInput class="field-row__control" :model-value="config.uploadFolder" placeholder="例如 img/test" @update:modelValue="updateField('uploadFolder', $event)" />
        </label>

        <label class="field field-row">
          <span class="field-row__label">命名方式</span>
          <SySelect class="field-row__control" :model-value="config.uploadNameType" :options="uploadNameTypeOptions" @update:modelValue="updateField('uploadNameType', $event)" />
        </label>

        <label class="field field-row">
          <span class="field-row__label">返回格式</span>
          <SySelect class="field-row__control" :model-value="config.returnFormat" :options="returnFormatOptions" @update:modelValue="updateField('returnFormat', $event)" />
        </label>

        <label class="field field-row">
          <span class="field-row__label">分块大小（MB）</span>
          <SyInput class="field-row__control" :model-value="config.chunkSizeMB" type="number" min="1" @update:modelValue="updateField('chunkSizeMB', Number($event))" />
        </label>
      </div>

      <div class="config-inline-options">
        <button
          type="button"
          class="toggle-chip toggle-chip--wide"
          :class="{ 'toggle-chip--active': config.serverCompress }"
          @click="updateField('serverCompress', !config.serverCompress)"
        >
          <span>{{ config.serverCompress ? '已开启服务端压缩' : '未开启服务端压缩' }}</span>
          <span class="toggle-chip__hint">仅 Telegram 有效</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import SyInput from '@/components/SiyuanTheme/SyInput.vue'
import SySelect from '@/components/SiyuanTheme/SySelect.vue'
import { testCfBedConfig } from '@/services/cfbed-upload'
import type { CfBedConfig, ConfigTestResult } from '@/types/plugin'

const props = defineProps<{
  config: CfBedConfig
}>()

const emit = defineEmits<{
  (e: 'change', payload: { id: string, key: string, value: any }): void
  (e: 'remove', id: string): void
}>()

const expanded = ref(false)
const testing = ref(false)
const testResult = ref<ConfigTestResult | null>(null)

const uploadChannelOptions = [
  { value: 'telegram', text: 'Telegram' },
  { value: 'cfr2', text: 'Cloudflare R2' },
  { value: 's3', text: 'S3' },
  { value: 'discord', text: 'Discord' },
  { value: 'huggingface', text: 'Hugging Face' },
]

const uploadNameTypeOptions = [
  { value: 'default', text: '前缀_原名' },
  { value: 'index', text: '仅前缀' },
  { value: 'origin', text: '仅原名' },
  { value: 'short', text: '短链接' },
]

const returnFormatOptions = [
  { value: 'default', text: '默认' },
  { value: 'full', text: '完整链接' },
]

function uploadChannelLabel(channel: string) {
  return uploadChannelOptions.find(item => item.value === channel)?.text || channel
}

const testChipText = computed(() => {
  if (testing.value)
    return '测试中'
  if (!testResult.value)
    return '测试'
  return testResult.value.ok ? '通过' : '失败'
})

const testChipClass = computed(() => {
  if (!testResult.value)
    return ''
  return testResult.value.ok ? 'test-chip--success' : 'test-chip--error'
})

async function handleTest() {
  testing.value = true
  try {
    testResult.value = await testCfBedConfig(props.config)
  }
  catch (error: any) {
    testResult.value = {
      ok: false,
      message: error?.message || '测试失败',
    }
  }
  finally {
    testing.value = false
  }
}

function updateField(key: string, value: any) {
  emit('change', {
    id: props.config.id,
    key,
    value,
  })
}
</script>
