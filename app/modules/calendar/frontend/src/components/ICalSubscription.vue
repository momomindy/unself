<!-- SPDX-License-Identifier: AGPL-3.0-only -->
<script setup lang="ts">
import { ref } from 'vue'
import { AuthExpiredError, generateFeedUrl, revokeFeedUrl } from '../lib/api'

const url = ref('')
const linkInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const message = ref('')
const failed = ref(false)

async function update(action: 'generate' | 'revoke'): Promise<void> {
  busy.value = true
  message.value = ''
  failed.value = false
  try {
    if (action === 'generate') {
      url.value = ''
      url.value = await generateFeedUrl()
      message.value = '订阅链接已生成，请现在复制。'
    } else {
      await revokeFeedUrl()
      url.value = ''
      message.value = '订阅已撤销。'
    }
  } catch (error) {
    failed.value = true
    if (error instanceof AuthExpiredError) {
      url.value = ''
      message.value = '登录已过期，请重新登录。'
    } else {
      message.value = action === 'generate' ? '生成订阅失败，请重试。' : '撤销订阅失败，请重试。'
    }
  } finally {
    busy.value = false
  }
}

async function copy(): Promise<void> {
  busy.value = true
  try {
    await navigator.clipboard.writeText(url.value)
    failed.value = false
    message.value = '订阅链接已复制。'
  } catch {
    linkInput.value?.focus()
    linkInput.value?.select()
    failed.value = true
    message.value = '自动复制失败，请手动复制选中的链接。'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section aria-labelledby="ical-heading">
    <h3 id="ical-heading">iCal 订阅</h3>
    <p>生成新链接会使旧链接失效。完整链接仅在生成后显示，请及时复制。</p>
    <div class="actions">
      <button type="button" :disabled="busy" @click="update('generate')">生成链接</button>
      <button v-if="url" type="button" :disabled="busy" @click="copy">复制链接</button>
      <button type="button" :disabled="busy" @click="update('revoke')">撤销订阅</button>
    </div>
    <input
      v-if="url"
      ref="linkInput"
      :value="url"
      aria-label="完整订阅链接"
      readonly
      autocomplete="off"
      spellcheck="false"
    />
    <p v-if="message" :role="failed ? 'alert' : 'status'">{{ message }}</p>
  </section>
</template>

<style scoped>
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--unself-space-2);
  margin-block-end: var(--unself-space-2);
}

button, input {
  font: inherit;
  color: var(--unself-color-text);
  background: var(--unself-color-surface);
  border: 1px solid var(--unself-color-border);
  border-radius: var(--unself-radius-md);
  padding: var(--unself-space-1) var(--unself-space-2);
}

input {
  box-sizing: border-box;
  inline-size: 100%;
}
</style>
