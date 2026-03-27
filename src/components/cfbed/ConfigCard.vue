<template>
  <div class="config-card surface-card" :class="{ 'config-card--enabled': config.enabled }">
    <div class="config-head config-head--inline">
      <div class="config-head__summary config-head__summary--compact">
        <strong class="config-summary-line config-summary-line--name">{{ config.name || t('common.untitledConfig', '未命名配置') }}</strong>
        <span class="config-summary-line config-summary-line--channel">{{ uploadChannelLabel(config.uploadChannel) }}</span>
        <span class="config-summary-line config-summary-line--host">{{ config.publicDomain || config.host || t('config.summary.publicDomainMissing', '未配置公开域名') }}</span>
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
          {{ config.enabled ? t('config.enabled.on', '已启用') : t('config.enabled.off', '未启用') }}
        </button>
        <SyButton class="header-btn config-head__btn" @click="expanded = !expanded">
          {{ expanded ? t('common.collapse', '收起') : t('common.expand', '展开') }}
        </SyButton>
        <SyButton class="ui-btn ui-btn--danger config-head__btn" @click="$emit('remove', config.id)">{{ t('common.delete', '删除') }}</SyButton>
      </div>
    </div>

    <div v-if="expanded" class="config-advanced">
      <div class="config-insight-grid">
        <div class="config-insight-card">
          <span class="config-insight-card__label">{{ t('config.card.authMode', '鉴权方式') }}</span>
          <strong class="config-insight-card__value">{{ authModeLabel }}</strong>
        </div>

        <div class="config-insight-card">
          <span class="config-insight-card__label">{{ t('config.card.publicBaseUrl', '公开链接基址') }}</span>
          <strong class="config-insight-card__value">{{ publicBaseUrl }}</strong>
        </div>

        <div class="config-insight-card">
          <span class="config-insight-card__label">{{ t('config.card.uploadStrategy', '上传策略') }}</span>
          <strong class="config-insight-card__value">{{ uploadStrategyLabel }}</strong>
        </div>
      </div>

      <div v-if="configWarnings.length" class="config-warning-list">
        <div
          v-for="warning in configWarnings"
          :key="warning"
          class="config-warning-item"
        >
          {{ warning }}
        </div>
      </div>

      <section class="config-section">
        <div class="config-section__head">
          <div class="config-section__title">{{ t('config.section.access.title', '访问与标识') }}</div>
          <div class="config-section__desc">{{ t('config.section.access.desc', '定义接口地址、公开域名和目标上传渠道。') }}</div>
        </div>

        <div class="grid-two grid-two--loose">
          <label class="field field-row">
            <span class="field-row__label">{{ t('common.name', '名称') }}</span>
            <SyInput class="field-row__control" :model-value="config.name" @update:modelValue="updateField('name', $event)" />
          </label>

          <label class="field field-row">
            <span class="field-row__label">{{ t('config.field.host', '站点地址') }}</span>
            <SyInput class="field-row__control" :model-value="config.host" placeholder="https://img.example.com" @update:modelValue="updateField('host', $event)" />
          </label>

          <label class="field field-row">
            <span class="field-row__label">{{ t('common.publicDomain', '公开域名') }}</span>
            <SyInput class="field-row__control" :model-value="config.publicDomain" placeholder="https://cdn.example.com" @update:modelValue="updateField('publicDomain', $event)" />
          </label>

          <label class="field field-row">
            <span class="field-row__label">{{ t('common.uploadChannel', '上传渠道') }}</span>
            <SySelect class="field-row__control" :model-value="config.uploadChannel" :options="uploadChannelOptions" @update:modelValue="updateField('uploadChannel', $event)" />
          </label>

          <label class="field field-row">
            <span class="field-row__label">{{ t('config.field.channelName', '渠道名称') }}</span>
            <SyInput class="field-row__control" :model-value="config.channelName" :placeholder="t('config.placeholder.channelName', '可选')" @update:modelValue="updateField('channelName', $event)" />
          </label>
        </div>
      </section>

      <section class="config-section">
        <div class="config-section__head">
          <div class="config-section__title">{{ t('config.section.authReturn.title', '鉴权与返回') }}</div>
          <div class="config-section__desc">{{ t('config.section.authReturn.desc', '控制访问凭证、上传目录和返回链接格式。') }}</div>
        </div>

        <div class="grid-two grid-two--loose">
          <label class="field field-row">
            <span class="field-row__label">{{ t('config.field.token', 'API 令牌') }}</span>
            <SyInput class="field-row__control" :model-value="config.token" @update:modelValue="updateField('token', $event)" />
          </label>

          <label class="field field-row">
            <span class="field-row__label">{{ t('config.field.authCode', '上传认证码') }}</span>
            <SyInput class="field-row__control" :model-value="config.authCode" @update:modelValue="updateField('authCode', $event)" />
          </label>

          <label class="field field-row">
            <span class="field-row__label">{{ t('config.field.uploadFolder', '上传目录') }}</span>
            <SyInput class="field-row__control" :model-value="config.uploadFolder" :placeholder="t('config.placeholder.uploadFolder', '例如 img/test')" @update:modelValue="updateField('uploadFolder', $event)" />
          </label>

          <label class="field field-row">
            <span class="field-row__label">{{ t('config.field.uploadNameType', '命名方式') }}</span>
            <SySelect class="field-row__control" :model-value="config.uploadNameType" :options="uploadNameTypeOptions" @update:modelValue="updateField('uploadNameType', $event)" />
          </label>

          <label class="field field-row">
            <span class="field-row__label">{{ t('config.field.returnFormat', '返回格式') }}</span>
            <SySelect class="field-row__control" :model-value="config.returnFormat" :options="returnFormatOptions" @update:modelValue="updateField('returnFormat', $event)" />
          </label>
        </div>
      </section>

      <section class="config-section">
        <div class="config-section__head">
          <div class="config-section__title">{{ t('config.section.strategy.title', '上传策略') }}</div>
          <div class="config-section__desc">{{ t('config.section.strategy.desc', '控制大文件分块和失败后的重试行为。') }}</div>
        </div>

        <div class="grid-two grid-two--loose">
          <label v-if="showChunkSize" class="field field-row">
            <span class="field-row__label">{{ t('config.field.chunkSize', '分块大小（MB）') }}</span>
            <SyInput class="field-row__control" :model-value="config.chunkSizeMB" type="number" min="1" @update:modelValue="updateField('chunkSizeMB', Number($event))" />
          </label>
        </div>

        <div class="config-inline-options">
          <button
            type="button"
            class="toggle-chip toggle-chip--wide"
            :class="{ 'toggle-chip--active': config.autoRetry }"
            @click="updateField('autoRetry', !config.autoRetry)"
          >
            <span>{{ config.autoRetry ? t('config.autoRetry.on', '失败自动重试已开启') : t('config.autoRetry.off', '失败自动重试已关闭') }}</span>
            <span class="toggle-chip__hint">{{ t('config.autoRetry.hint', '按 CloudFlare-ImgBed 的 autoRetry 参数发送') }}</span>
          </button>

          <div v-if="!showChunkSize" class="config-channel-note">
            {{ t('config.huggingFace.chunkNote', 'Hugging Face 渠道由服务端处理大文件，无需客户端分块。') }}
          </div>
        </div>
      </section>

      <div v-if="showServerCompress" class="config-inline-options">
        <button
          type="button"
          class="toggle-chip toggle-chip--wide"
          :class="{ 'toggle-chip--active': config.serverCompress }"
          @click="updateField('serverCompress', !config.serverCompress)"
        >
          <span>{{ config.serverCompress ? t('config.serverCompress.on', '已开启服务端压缩') : t('config.serverCompress.off', '未开启服务端压缩') }}</span>
          <span class="toggle-chip__hint">{{ t('config.serverCompress.hint', '仅 Telegram 有效') }}</span>
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
import { useI18n } from '@/utils/i18n'

const props = defineProps<{
  config: CfBedConfig
}>()

const emit = defineEmits<{
  (e: 'change', payload: { id: string, key: string, value: any }): void
  (e: 'remove', id: string): void
}>()

const { t } = useI18n()
const expanded = ref(false)
const testing = ref(false)
const testResult = ref<ConfigTestResult | null>(null)

const uploadChannelOptions = computed(() => [
  { value: 'telegram', text: 'Telegram' },
  { value: 'cfr2', text: 'Cloudflare R2' },
  { value: 's3', text: 'S3' },
  { value: 'discord', text: 'Discord' },
  { value: 'huggingface', text: 'Hugging Face' },
])

const uploadNameTypeOptions = computed(() => [
  { value: 'default', text: t('config.option.uploadName.default', '前缀_原名') },
  { value: 'index', text: t('config.option.uploadName.index', '仅前缀') },
  { value: 'origin', text: t('config.option.uploadName.origin', '仅原名') },
  { value: 'short', text: t('config.option.uploadName.short', '短链接') },
])

const returnFormatOptions = computed(() => [
  { value: 'default', text: t('config.option.returnFormat.default', '默认') },
  { value: 'full', text: t('config.option.returnFormat.full', '完整链接') },
])

const showChunkSize = computed(() => props.config.uploadChannel !== 'huggingface')
const showServerCompress = computed(() => props.config.uploadChannel === 'telegram')
const authModeLabel = computed(() => {
  if (props.config.token)
    return 'Bearer Token'
  if (props.config.authCode)
    return t('config.authMode.authCode', '上传认证码')
  return t('config.authMode.none', '未配置鉴权')
})
const publicBaseUrl = computed(() => props.config.publicDomain || props.config.host || t('common.unconfigured', '未配置'))
const uploadStrategyLabel = computed(() => {
  const labels = [uploadChannelLabel(props.config.uploadChannel)]
  if (showChunkSize.value)
    labels.push(t('config.uploadStrategy.chunked', '超过 {size}MB 分块上传', { size: props.config.chunkSizeMB }))
  if (props.config.autoRetry)
    labels.push(t('config.uploadStrategy.autoRetry', '失败自动重试'))
  return labels.join(' / ')
})
const configWarnings = computed(() => {
  const warnings: string[] = []

  if (!props.config.host)
    warnings.push(t('config.warning.host', '未填写站点地址，当前配置无法发起上传。'))
  if (!props.config.token && !props.config.authCode)
    warnings.push(t('config.warning.auth', '未填写 Token 或上传认证码，若实例启用了鉴权，请补齐其中之一。'))
  if (props.config.publicDomain && !/^https?:\/\//i.test(props.config.publicDomain))
    warnings.push(t('config.warning.publicDomain', '公开域名建议填写完整 URL，避免返回链接拼接错误。'))

  return warnings
})

function uploadChannelLabel(channel: string) {
  return uploadChannelOptions.value.find(item => item.value === channel)?.text || channel
}

const testChipText = computed(() => {
  if (testing.value)
    return t('config.test.testing', '测试中')
  if (!testResult.value)
    return t('config.test.idle', '测试')
  return testResult.value.ok
    ? t('config.test.success', '通过')
    : t('config.test.failed', '失败')
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
      message: error?.message || t('config.test.failedFallback', '测试失败'),
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
