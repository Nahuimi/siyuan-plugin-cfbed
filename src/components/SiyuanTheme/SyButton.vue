<template>
  <button class="sy-btn" v-bind="$attrs">
    <slot />
  </button>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>
