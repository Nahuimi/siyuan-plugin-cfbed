<template>
  <aside class="cfbed-sidebar">
    <section class="shell-card brand-card">
      <div class="shell-card__title">{{ t('panel.sidebar.scope.title', '当前范围') }}</div>
      <div class="shell-doc-title">{{ currentDocTitle || t('common.currentDocMissing', '未定位到当前笔记') }}</div>
      <div class="shell-doc-desc">{{ t('panel.sidebar.scope.desc', '只处理当前活动文档中的 Markdown / HTML 图片链接。') }}</div>
    </section>

    <section class="shell-card sidebar-card">
      <div class="shell-card__title">{{ t('panel.sidebar.quick.title', '快速操作') }}</div>
      <div class="sidebar-actions">
        <SyButton class="action-btn ui-btn ui-btn--primary" @click="$emit('refresh-images')">{{ t('panel.sidebar.quick.refresh', '刷新扫描') }}</SyButton>
        <SyButton
          class="action-btn"
          :disabled="imageUploading || replacePreviewActive || !selectedUploadableCount"
          @click="$emit('upload-selected')"
        >
          {{ imageUploading
            ? t('panel.sidebar.quick.uploading', '上传中...')
            : t('panel.sidebar.quick.uploadSelected', '上传所选（{count}）', { count: selectedUploadableCount }) }}
        </SyButton>
        <SyButton class="action-btn" @click="$emit('retry-failed')">{{ t('panel.sidebar.quick.retryFailed', '重试失败项') }}</SyButton>
        <SyButton class="action-btn" :disabled="!replaceableCount" @click="$emit('build-replace-preview')">{{ t('panel.sidebar.quick.buildReplacePreview', '生成替换预览') }}</SyButton>

        <template v-if="replacePreviewActive">
          <SyButton class="action-btn ui-btn ui-btn--primary" :disabled="!replacePreviewImagesCount" @click="$emit('confirm-replace')">
            {{ t('panel.sidebar.quick.confirmReplace', '确认替换（{count}）', { count: replacePreviewImagesCount }) }}
          </SyButton>
          <SyButton class="action-btn" @click="$emit('cancel-replace')">{{ t('panel.sidebar.quick.cancelReplace', '取消替换') }}</SyButton>
        </template>
      </div>
    </section>

    <section class="shell-card sidebar-card">
      <div class="shell-card__title">{{ t('panel.sidebar.config.title', '当前配置') }}</div>
      <div v-if="activeConfigSummary" class="info-list">
        <div class="info-row">
          <span class="info-row__label">{{ t('common.name', '名称') }}</span>
          <strong class="info-row__value">{{ activeConfigSummary.name || t('common.untitledConfig', '未命名配置') }}</strong>
        </div>
        <div class="info-row">
          <span class="info-row__label">{{ t('common.uploadChannel', '上传渠道') }}</span>
          <span class="info-row__value">{{ activeConfigSummary.channelLabel }}</span>
        </div>
        <div class="info-row">
          <span class="info-row__label">{{ t('common.interfaceAddress', '接口地址') }}</span>
          <span class="info-row__value">{{ activeConfigSummary.host || t('common.unconfigured', '未配置') }}</span>
        </div>
        <div class="info-row">
          <span class="info-row__label">{{ t('common.publicDomain', '公开域名') }}</span>
          <span class="info-row__value">{{ activeConfigSummary.publicDomain || t('common.unconfigured', '未配置') }}</span>
        </div>
      </div>
      <div v-else class="minor-text">{{ t('panel.sidebar.config.empty', '暂无可用配置，请先在“图床配置”中完成设置。') }}</div>
    </section>

    <section class="shell-card sidebar-card">
      <div class="shell-card__title">{{ t('panel.sidebar.rules.title', '识别规则') }}</div>
      <div class="info-list">
        <div class="info-row">
          <span class="info-row__label">{{ t('panel.sidebar.rules.ownDomains', '自己图床域名') }}</span>
          <span class="info-row__value">{{ ownDomainsCount }}</span>
        </div>
        <div class="info-row">
          <span class="info-row__label">{{ t('panel.sidebar.rules.replaceMode', '替换模式') }}</span>
          <span class="info-row__value">{{ autoReplace ? t('panel.sidebar.rules.replaceMode.auto', '上传后自动替换') : t('panel.sidebar.rules.replaceMode.manual', '手动确认替换') }}</span>
        </div>
        <div class="info-row">
          <span class="info-row__label">{{ t('common.currentTheme', '当前主题') }}</span>
          <span class="info-row__value">{{ themeModeLabel }}</span>
        </div>
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import type { ActiveConfigSummary } from '@/types/plugin'
import { useI18n } from '@/utils/i18n'

defineProps<{
  currentDocTitle: string
  imageUploading: boolean
  replacePreviewActive: boolean
  selectedUploadableCount: number
  replaceableCount: number
  replacePreviewImagesCount: number
  ownDomainsCount: number
  autoReplace: boolean
  themeModeLabel: string
  activeConfigSummary: ActiveConfigSummary | null
}>()

defineEmits<{
  (e: 'refresh-images'): void
  (e: 'upload-selected'): void
  (e: 'retry-failed'): void
  (e: 'build-replace-preview'): void
  (e: 'confirm-replace'): void
  (e: 'cancel-replace'): void
}>()

const { t } = useI18n()
</script>
