<template>
  <section class="section-card glass-card settings-panel-section">
    <div class="section-head">
      <div>
        <div class="section-title">图床配置</div>
      </div>

      <div class="toolbar-row wrap">
        <SyButton class="ui-btn ui-btn--primary" @click="$emit('add-config')">新增配置</SyButton>
      </div>
    </div>

    <div class="settings-two-column-grid">
      <label class="field own-domain-card settings-column settings-column--right settings-column--align-top settings-textarea-card">
        <div class="field-card__head">
          <span class="field-card__label">自己的图床域名列表（每行一个）</span>
        </div>
        <textarea
          class="sy-textarea own-domain-textarea"
          :value="settings.ownDomainsText"
          rows="6"
          placeholder="例如：&#10;img.example.com&#10;cdn.example.com"
          @input="updateRoot('ownDomainsText', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </div>

    <div class="config-list">
      <ConfigCard
        v-for="config in settings.configs"
        :key="config.id"
        :config="config"
        @change="handleConfigChange"
        @remove="$emit('remove-config', $event)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import SyButton from '@/components/SiyuanTheme/SyButton.vue'
import ConfigCard from './ConfigCard.vue'
import type { PluginSettings } from '@/types/plugin'

const props = defineProps<{
  settings: PluginSettings
  configOptions: Array<{ value: string, text: string }>
}>()

const emit = defineEmits<{
  (e: 'add-config'): void
  (e: 'remove-config', id: string): void
  (e: 'change'): void
}>()

function updateRoot(key: keyof PluginSettings, value: any) {
  ;(props.settings as any)[key] = value
  emit('change')
}

function handleConfigChange(payload: { id: string, key: string, value: any }) {
  const target = props.settings.configs.find(item => item.id === payload.id)
  if (!target)
    return
  ;(target as any)[payload.key] = payload.value
  emit('change')
}
</script>
