<template>
  <select
    class="sy-select"
    :value="modelValue"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-for="item in options" :key="item.value" :value="item.value">
      {{ item.text }}
    </option>
  </select>
</template>

<script setup lang="ts">
defineProps<{
  modelValue?: string | number
  options: Array<{ value: string | number, text: string }>
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>
