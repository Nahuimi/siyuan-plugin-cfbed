<template>
  <div v-if="visible" class="dialog-mask replace-preview-mask" @click.self="$emit('close')">
    <div class="dialog-panel replace-preview-dialog-panel">
      <div class="replace-preview-shell">
        <div class="replace-preview-header section-head">
          <div class="replace-preview-header__main">
            <div class="replace-preview-header__title">替换预览</div>
            <div class="replace-preview-header__desc">
              {{ items.length ? '确认本次旧链接与新链接的替换映射，提交后将批量写回文档。' : '当前还没有可替换的数据，完成上传后这里会展示统一的替换预览列表。' }}
            </div>
          </div>
          <span class="tag replace-preview-header__badge">
            {{ items.length ? 'READY' : 'EMPTY' }}
          </span>
        </div>

        <div class="replace-preview-overview">
          <div class="replace-preview-metric" :class="{ 'replace-preview-metric--muted': !items.length }">
            <div class="replace-preview-metric__label">待替换链接</div>
            <div class="replace-preview-metric__value">{{ items.length }}</div>
          </div>
          <div class="replace-preview-metric" :class="{ 'replace-preview-metric--muted': !items.length }">
            <div class="replace-preview-metric__label">涉及文档</div>
            <div class="replace-preview-metric__value">{{ uniqueDocCount }}</div>
          </div>
        </div>

        <div class="replace-preview-content" :class="{ 'replace-preview-content--empty': !items.length }">
          <template v-if="items.length">
            <div class="preview-list replace-preview-list">
              <div
                v-for="item in items"
                :key="`${item.docId}-${item.imageId}-${item.oldUrl}`"
                class="replace-preview-card"
              >
                <div class="replace-preview-card__head">
                  <div>
                    <div class="replace-preview-card__doc">{{ item.docHPath || item.docPath || item.docId }}</div>
                    <div class="replace-preview-card__sub">图片资源链接替换</div>
                  </div>
                  <span class="tag replace-preview-card__badge">LINK</span>
                </div>

                <div class="replace-preview-card__compare">
                  <div class="replace-preview-link-block">
                    <div class="replace-preview-link-block__label">旧链接</div>
                    <div class="replace-preview-link-block__value">{{ item.oldUrl }}</div>
                  </div>
                  <div class="replace-preview-link-block replace-preview-link-block--next">
                    <div class="replace-preview-link-block__label">新链接</div>
                    <div class="replace-preview-link-block__value">{{ item.newUrl }}</div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="replace-preview-empty-wrap">
              <div class="preview-list replace-preview-list replace-preview-list--empty">
                <div class="replace-preview-card replace-preview-card--empty-state">
                  <div class="replace-preview-card__head">
                    <div>
                      <div class="replace-preview-card__doc">等待生成替换项</div>
                      <div class="replace-preview-card__sub">完成上传后，这里会展示文档路径与链接替换详情</div>
                    </div>
                    <span class="tag replace-preview-card__badge replace-preview-card__badge--empty">EMPTY</span>
                  </div>

                  <div class="replace-preview-card__compare">
                    <div class="replace-preview-link-block replace-preview-link-block--placeholder">
                      <div class="replace-preview-link-block__label">旧链接</div>
                      <div class="replace-preview-link-block__placeholder">assets/old-image-example.png</div>
                    </div>
                    <div class="replace-preview-link-block replace-preview-link-block--next replace-preview-link-block--placeholder">
                      <div class="replace-preview-link-block__label">新链接</div>
                      <div class="replace-preview-link-block__placeholder">https://your-domain.example/file/new-image-example.png</div>
                    </div>
                  </div>
                </div>

                <div class="replace-preview-empty-card">
                  <div class="replace-preview-empty-card__icon">🖼️</div>
                  <div class="replace-preview-empty-card__title">当前没有可替换项目</div>
                  <div class="replace-preview-empty-card__desc">先完成图片上传，再回来查看旧链接和新链接的替换对照。</div>
                  <div class="replace-preview-empty-card__tips">
                    <span class="summary-badge">先完成上传</span>
                    <span class="summary-badge">生成新图床链接</span>
                    <span class="summary-badge">再打开替换预览</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="replace-preview-footer">
          <button class="replace-preview-header__btn replace-preview-header__btn--secondary" @click="$emit('close')">取消</button>
          <button class="replace-preview-header__btn replace-preview-header__btn--primary" :disabled="!items.length" @click="$emit('confirm')">确认替换</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReplacePreviewItem } from '@/types/plugin'

const props = defineProps<{
  visible: boolean
  items: ReplacePreviewItem[]
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
}>()

const uniqueDocCount = computed(() => new Set(props.items.map(item => item.docId)).size)
</script>

<style scoped lang="scss">
.replace-preview-mask {
  background: rgba(3, 6, 14, 0.78);
  backdrop-filter: blur(14px);
}

.replace-preview-dialog-panel {
  width: min(1080px, 100%);
  height: min(760px, 86vh);
  min-height: min(760px, 86vh);
  max-height: 86vh;
  padding: 0 !important;
  overflow: hidden;
  border-radius: 28px;
  border: 0;
  box-shadow: none;
  background: transparent;
}

.replace-preview-shell {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 12px;
  padding: 18px;
  height: 100%;
  min-height: 100%;
  border-radius: 28px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(20, 24, 36, 0.96), rgba(16, 20, 31, 0.94));
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 24px 80px rgba(0,0,0,0.45);
}

.replace-preview-header {
  margin-bottom: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.replace-preview-header__main {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.replace-preview-header__title {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.replace-preview-header__desc {
  color: rgba(255,255,255,0.64);
  font-size: 13px;
  line-height: 1.6;
}

.replace-preview-header__badge {
  align-self: center;
  background: rgba(76, 110, 245, 0.14);
  color: #dbe4ff;
  font-size: 12px;
  font-weight: 700;
}

.replace-preview-header__btn {
  min-width: 96px;
  min-height: 36px;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.08);
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.16s ease;
}

.replace-preview-header__btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  filter: grayscale(0.1);
}

.replace-preview-header__btn--secondary {
  background: rgba(255,255,255,0.06);
  color: #fff;
}

.replace-preview-header__btn--secondary:hover {
  background: rgba(255,255,255,0.1);
  border-color: rgba(255,255,255,0.12);
}

.replace-preview-header__btn--primary {
  background: linear-gradient(135deg, #4c6ef5, #15aabf);
  color: #fff;
  border-color: transparent;
}

.replace-preview-header__btn--primary:hover {
  filter: brightness(1.05);
}

.replace-preview-overview {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.replace-preview-metric {
  height: 88px;
  min-height: 88px;
  padding: 12px 14px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.04));
  border: 1px solid rgba(255,255,255,0.07);
  display: grid;
  align-content: center;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
}

.replace-preview-metric--muted {
  background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.03));
}

.replace-preview-metric__label {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  margin-bottom: 6px;
}

.replace-preview-metric__value {
  font-size: 20px;
  line-height: 1;
  font-weight: 800;
  color: #fff;
}

.replace-preview-list {
  height: 100%;
  min-height: 0;
  max-height: none;
  overflow: auto;
  padding-right: 6px;
  display: grid;
  gap: 12px;
  align-content: start;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.18) rgba(255,255,255,0.04);
}

.replace-preview-list::-webkit-scrollbar {
  width: 10px;
}

.replace-preview-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(255,255,255,0.18);
}

.replace-preview-list::-webkit-scrollbar-track {
  background: rgba(255,255,255,0.04);
}

.replace-preview-list--empty {
  grid-template-rows: minmax(0, auto) minmax(0, 1fr);
}

.replace-preview-card {
  display: grid;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.035));
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
}

.replace-preview-card--empty-state {
  border-color: rgba(255,255,255,0.08);
}

.replace-preview-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.replace-preview-card__doc {
  font-size: 14px;
  font-weight: 700;
  color: #fff;
}

.replace-preview-card__sub {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(255,255,255,0.56);
}

.replace-preview-card__badge {
  background: rgba(76, 110, 245, 0.14);
  color: #dbe4ff;
  font-size: 12px;
  font-weight: 700;
}

.replace-preview-card__badge--empty {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.76);
}

.replace-preview-card__compare {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.replace-preview-link-block {
  min-height: 84px;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
}

.replace-preview-link-block--next {
  background: linear-gradient(135deg, rgba(76, 110, 245, 0.14), rgba(21, 170, 191, 0.08));
  border-color: rgba(76, 110, 245, 0.24);
}

.replace-preview-link-block--placeholder {
  background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.025));
}

.replace-preview-link-block__label {
  font-size: 12px;
  color: rgba(255,255,255,0.62);
  margin-bottom: 6px;
}

.replace-preview-link-block__value {
  color: rgba(255,255,255,0.92);
  line-height: 1.4;
  white-space: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  word-break: normal;
  scrollbar-width: thin;
}

.replace-preview-link-block__placeholder {
  color: rgba(255,255,255,0.38);
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.replace-preview-empty-wrap {
  height: 100%;
  min-height: 0;
  display: grid;
}

.replace-preview-content {
  height: 100%;
  min-height: 0;
  padding: 2px 0;
}

.replace-preview-content--empty {
  display: grid;
}

.replace-preview-empty-card {
  height: 100%;
  min-height: 0;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 12px;
  padding: 24px 20px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.035));
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
  text-align: center;
  min-height: 260px;
}

.replace-preview-empty-card__icon {
  width: 64px;
  height: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  font-size: 28px;
  background: linear-gradient(135deg, rgba(76, 110, 245, 0.18), rgba(21, 170, 191, 0.14));
  border: 1px solid rgba(76, 110, 245, 0.2);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
}

.replace-preview-empty-card__title {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}

.replace-preview-empty-card__desc {
  max-width: 480px;
  color: rgba(255,255,255,0.68);
  line-height: 1.6;
}

.replace-preview-empty-card__tips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 4px;
}

.replace-preview-footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  padding-top: 4px;
  border-top: 1px solid rgba(255,255,255,0.08);
}

@media (max-width: 960px) {
  .replace-preview-card__compare,
  .replace-preview-overview {
    grid-template-columns: 1fr;
  }

  .replace-preview-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .replace-preview-overview {
    display: grid;
  }

  .replace-preview-metric {
    min-height: 72px;
    height: auto;
  }

  .replace-preview-shell {
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    padding: 16px;
  }

  .replace-preview-list,
  .replace-preview-empty-wrap {
    height: auto;
    max-height: none;
  }

  .replace-preview-list--empty {
    grid-template-rows: none;
  }

  .replace-preview-footer {
    justify-content: stretch;
  }
}
</style>
