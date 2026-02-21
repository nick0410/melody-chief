/**
 * app.js — Shared utility for Melody Chief
 * Handles URL param messages, input polish, and form helpers across all pages.
 */

(function () {
    'use strict';

    // ── URL param → in-page message ───────────────────────────────────────────
    function applyUrlMessages() {
        var el = document.getElementById('error-message');
        if (!el) return;

        var params  = new URLSearchParams(window.location.search);
        var error   = params.get('error');
        var message = params.get('message');

        if (error) {
            el.style.color = '#ff5252';
            el.textContent = error;
        } else if (message) {
            el.style.color = '#2e7d32';
            el.textContent = message;
        }

        // Clean URL without reloading
        if ((error || message) && window.history.replaceState) {
            var clean = window.location.pathname;
            window.history.replaceState({}, document.title, clean);
        }
    }

    // ── Password strength indicator ───────────────────────────────────────────
    function attachPasswordStrength() {
        var pwdInput = document.querySelector('input[type="password"]');
        if (!pwdInput) return;

        var hint = document.createElement('small');
        hint.id  = 'pwd-hint';
        hint.style.cssText = 'display:block;margin-top:-10px;margin-bottom:8px;font-size:0.78em;transition:color 0.3s';
        pwdInput.parentNode.insertBefore(hint, pwdInput.nextSibling);

        pwdInput.addEventListener('input', function () {
            var v = pwdInput.value;
            if (!v) { hint.textContent = ''; return; }
            if (v.length < 6) {
                hint.style.color = '#ff5252';
                hint.textContent = 'Too short — min 6 characters';
            } else if (v.length < 10 || !/[0-9]/.test(v)) {
                hint.style.color = '#f57c00';
                hint.textContent = 'Fair — add numbers or symbols to strengthen';
            } else {
                hint.style.color = '#2e7d32';
                hint.textContent = 'Strong password ✓';
            }
        });
    }

    // ── Smooth button loading state ───────────────────────────────────────────
    function attachFormLoadingState() {
        var forms = document.querySelectorAll('form[action]');
        forms.forEach(function (form) {
            form.addEventListener('submit', function () {
                var btn = form.querySelector('button[type="submit"]');
                if (btn) {
                    btn.disabled     = true;
                    btn.dataset.orig = btn.textContent;
                    btn.textContent  = 'Please wait…';
                    // Re-enable after 5s in case of redirect failure
                    setTimeout(function () {
                        btn.disabled    = false;
                        btn.textContent = btn.dataset.orig;
                    }, 5000);
                }
            });
        });
    }

    // ── Boot ──────────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        applyUrlMessages();
        attachPasswordStrength();
        attachFormLoadingState();
    });
}());
