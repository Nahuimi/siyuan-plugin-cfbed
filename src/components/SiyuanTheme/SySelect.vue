<template>
  <div
    ref="rootRef"
    class="sy-select-wrap"
    :class="{
      'sy-select-wrap--disabled': disabled,
      'sy-select-wrap--open': open,
    }"
    v-bind="wrapperAttrs"
  >
    <button
      ref="triggerRef"
      type="button"
      class="sy-select-trigger"
      :disabled="disabled"
      :title="selectedOption?.text"
      aria-haspopup="listbox"
      :aria-expanded="open"
      v-bind="triggerAttrs"
      @click="toggleOpen"
      @keydown="handleTriggerKeydown"
    >
      <span class="sy-select__label">{{ selectedOption?.text || placeholderText }}</span>
      <span class="sy-select-wrap__icon" aria-hidden="true">
        <svg viewBox="0 0 12 12" fill="none">
          <path d="M2.5 4.25L6 7.75L9.5 4.25" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </button>

    <Teleport v-if="teleportTarget" :to="teleportTarget">
      <div
        v-if="open"
        ref="panelRef"
        class="sy-select-dropdown"
        :style="dropdownStyle"
        @mousedown.prevent
      >
        <div
          v-for="(item, index) in options"
          :key="item.value"
          class="sy-select-option"
          :class="{
            'sy-select-option--active': index === activeIndex,
            'sy-select-option--selected': isSelected(item.value),
          }"
          role="option"
          :aria-selected="isSelected(item.value)"
          @mouseenter="activeIndex = index"
          @click="selectOption(item.value)"
        >
          <span class="sy-select-option__label">{{ item.text }}</span>
          <span v-if="isSelected(item.value)" class="sy-select-option__mark" aria-hidden="true">
            <svg viewBox="0 0 12 12" fill="none">
              <path d="M2.25 6.25L4.75 8.75L9.75 3.75" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  watch,
} from 'vue'
import { useI18n } from '@/utils/i18n'

type SelectOption = {
  value: string | number
  text: string
}

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue?: string | number
  options: SelectOption[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const { t } = useI18n()
const attrs = useAttrs()
const rootRef = ref<HTMLDivElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLDivElement | null>(null)
const teleportTarget = ref<HTMLElement | null>(null)
const open = ref(false)
const activeIndex = ref(-1)
const dropdownStyle = ref<Record<string, string>>({})

const disabled = computed(() => props.disabled || attrs.disabled !== undefined)
const selectedOption = computed(() =>
  props.options.find(item => isSameValue(item.value, props.modelValue)) || props.options[0],
)
const placeholderText = computed(() => String(attrs.placeholder || t('select.placeholder', '请选择')))

const wrapperAttrs = computed(() => ({
  class: attrs.class,
  style: attrs.style,
}))

const triggerAttrs = computed(() => {
  const {
    class: _class,
    style: _style,
    disabled: _disabled,
    placeholder: _placeholder,
    ...rest
  } = attrs

  return rest
})

function isSameValue(left: string | number | undefined, right: string | number | undefined) {
  return String(left ?? '') === String(right ?? '')
}

function isSelected(value: string | number) {
  return isSameValue(value, props.modelValue)
}

function syncActiveIndex() {
  const selectedIndex = props.options.findIndex(item => isSelected(item.value))
  activeIndex.value = selectedIndex >= 0 ? selectedIndex : 0
}

function updateDropdownPosition() {
  const trigger = triggerRef.value
  if (!trigger)
    return

  const rect = trigger.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const spaceBelow = viewportHeight - rect.bottom - 12
  const spaceAbove = rect.top - 12
  const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow
  const maxHeight = Math.max(160, Math.min(320, openUpward ? spaceAbove : spaceBelow))

  dropdownStyle.value = {
    position: 'fixed',
    left: `${rect.left}px`,
    top: openUpward ? 'auto' : `${rect.bottom + 6}px`,
    bottom: openUpward ? `${viewportHeight - rect.top + 6}px` : 'auto',
    width: `${rect.width}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: '1205',
  }
}

async function openDropdown() {
  if (disabled.value || !props.options.length)
    return

  syncActiveIndex()
  open.value = true
  await nextTick()
  updateDropdownPosition()
}

function closeDropdown() {
  open.value = false
}

function toggleOpen() {
  if (open.value) {
    closeDropdown()
    return
  }

  void openDropdown()
}

function selectOption(value: string | number) {
  emit('update:modelValue', String(value))
  closeDropdown()
  triggerRef.value?.focus()
}

function moveActive(step: number) {
  if (!props.options.length)
    return

  if (!open.value) {
    void openDropdown()
    return
  }

  const next = activeIndex.value < 0
    ? 0
    : (activeIndex.value + step + props.options.length) % props.options.length

  activeIndex.value = next
}

function handleTriggerKeydown(event: KeyboardEvent) {
  if (disabled.value)
    return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveActive(1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveActive(-1)
    return
  }

  if (event.key === 'Home') {
    if (!open.value)
      return
    event.preventDefault()
    activeIndex.value = 0
    return
  }

  if (event.key === 'End') {
    if (!open.value)
      return
    event.preventDefault()
    activeIndex.value = Math.max(0, props.options.length - 1)
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!open.value) {
      void openDropdown()
      return
    }

    const option = props.options[activeIndex.value]
    if (option)
      selectOption(option.value)
    return
  }

  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    closeDropdown()
  }
}

function handlePointerDown(event: MouseEvent) {
  const target = event.target as Node | null
  if (!target)
    return

  const clickedInsideTrigger = rootRef.value?.contains(target)
  const clickedInsidePanel = panelRef.value?.contains(target)
  if (!clickedInsideTrigger && !clickedInsidePanel)
    closeDropdown()
}

function handleWindowChange() {
  if (!open.value)
    return

  updateDropdownPosition()
}

watch(() => props.modelValue, () => {
  syncActiveIndex()
})

watch(() => props.options, () => {
  syncActiveIndex()
  if (open.value)
    void nextTick(updateDropdownPosition)
}, { deep: true })

watch(disabled, (value) => {
  if (value)
    closeDropdown()
})

watch(open, (value) => {
  if (!value)
    return

  document.addEventListener('mousedown', handlePointerDown)
  window.addEventListener('resize', handleWindowChange)
  window.addEventListener('scroll', handleWindowChange, true)
})

watch(open, (value, oldValue) => {
  if (value || !oldValue)
    return

  document.removeEventListener('mousedown', handlePointerDown)
  window.removeEventListener('resize', handleWindowChange)
  window.removeEventListener('scroll', handleWindowChange, true)
})

onMounted(() => {
  teleportTarget.value = rootRef.value?.closest('.cfbed-shell') as HTMLElement | null
  syncActiveIndex()
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handlePointerDown)
  window.removeEventListener('resize', handleWindowChange)
  window.removeEventListener('scroll', handleWindowChange, true)
})
</script>
