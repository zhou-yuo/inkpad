<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  loading?: boolean
}>(), {
  confirmText: '确认',
  cancelText: '取消',
  danger: false,
  loading: false,
})

const emit = defineEmits<{
  close: []
  confirm: []
}>()
</script>

<template>
  <AppModal :open="open" :title="title" :description="message" @close="emit('close')">
    <div class="confirm-actions">
      <button class="ghost-button" type="button" :disabled="loading" @click="emit('close')">{{ cancelText }}</button>
      <button
        class="primary-button"
        :class="{ danger }"
        type="button"
        :disabled="loading"
        @click="emit('confirm')"
      >
        {{ loading ? 'Working...' : confirmText }}
      </button>
    </div>
  </AppModal>
</template>
