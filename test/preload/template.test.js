'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { OVERLAY_HTML, OVERLAY_CSS } = require('../../src/preload/overlay/template');

test('OVERLAY_HTML 包含核心元素（精简版）', () => {
  assert.ok(OVERLAY_HTML.includes('estrix-overlay'));
  assert.ok(OVERLAY_HTML.includes('estrix-cmd-preview'));
  assert.ok(OVERLAY_HTML.includes('estrix-history-list'));
  assert.ok(OVERLAY_HTML.includes('estrix-btn-open-settings'));
  assert.ok(OVERLAY_HTML.includes('estrix-status-badge'));
});

test('OVERLAY_CSS 包含核心样式', () => {
  assert.ok(OVERLAY_CSS.includes('.estrix-overlay'));
  assert.ok(OVERLAY_CSS.includes('--ck-primary'));
  assert.ok(OVERLAY_CSS.includes('estrix-hidden'));
});
