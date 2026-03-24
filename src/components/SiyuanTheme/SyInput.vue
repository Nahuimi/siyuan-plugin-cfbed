<template>
  <input
    class="sy-input"
    :value="modelValue"
    v-bind="$attrs"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  >
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  modelValue?: string | number
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>
