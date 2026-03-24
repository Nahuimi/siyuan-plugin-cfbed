<template>
  <section class="section-card glass-card">
    <div class="section-head">
      <div>
        <div class="section-title">任务中心</div>
      </div>
    </div>

    <div class="task-grid">
      <div class="task-stat-card">
        <div class="task-stat-card__label">总任务</div>
        <div class="task-stat-card__value">{{ summary.total }}</div>
      </div>
      <div class="task-stat-card">
        <div class="task-stat-card__label">运行中</div>
        <div class="task-stat-card__value">{{ summary.running }}</div>
      </div>
      <div class="task-stat-card">
        <div class="task-stat-card__label">成功</div>
        <div class="task-stat-card__value">{{ summary.success }}</div>
      </div>
      <div class="task-stat-card">
        <div class="task-stat-card__label">失败</div>
        <div class="task-stat-card__value">{{ summary.error }}</div>
      </div>
      <div class="task-stat-card">
        <div class="task-stat-card__label">已取消</div>
        <div class="task-stat-card__value">{{ summary.cancelled }}</div>
      </div>
    </div>

    <div class="task-progress">
      <div class="task-progress__head">
        <span>总体进度</span>
        <strong>{{ summary.progress }}%</strong>
      </div>
      <div class="progress-bar">
        <div class="progress-bar__inner" :style="{ width: `${summary.progress}%` }" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { UploadTaskSummary } from '@/types/plugin'

defineProps<{
  summary: UploadTaskSummary
}>()
</script>
