<script setup lang="ts">
import { X } from '@lucide/vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description?: string
}>(), {
  description: '',
})

const emit = defineEmits<{
  close: []
}>()

function onKeydown(event: KeyboardEvent) {
  if (!props.open || event.key !== 'Escape') return
  emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="open" class="modal-backdrop" @click.self="emit('close')">
        <section class="modal-panel glass" role="dialog" aria-modal="true" :aria-label="title">
          <header class="modal-head">
            <div>
              <h2>{{ title }}</h2>
              <p v-if="description">{{ description }}</p>
            </div>
            <button class="icon-button modal-close" type="button" aria-label="Close" @click="emit('close')">
              <X aria-hidden="true" />
            </button>
          </header>
          <div class="modal-body">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
