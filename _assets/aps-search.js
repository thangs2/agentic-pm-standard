/**
 * APS static search.
 *
 * The index is injected as a lazy <script>, never fetch()ed JSON, so search works
 * when the wiki is opened straight from disk (file://) as well as from `bun run serve`.
 *
 * Contract with the build:
 *   - <body data-html-base="../..">  → relative prefix back to html/
 *   - [data-search-trigger]          → the header button
 *   - [data-search-dialog]           → the overlay (hidden until opened)
 *   - _assets/aps-search-index.js    → window.__APS_SEARCH__ = [{p,t,h,s,g,x}]
 */
(function () {
    'use strict';

    var dialog = document.querySelector('[data-search-dialog]');
    var trigger = document.querySelector('[data-search-trigger]');
    if (!dialog || !trigger) return;

    var input = dialog.querySelector('[data-search-input]');
    var list = dialog.querySelector('[data-search-results]');
    var emptyEl = dialog.querySelector('[data-search-empty]');
    var base = document.body.getAttribute('data-html-base') || '';

    var docs = null;
    var loading = false;
    var queue = [];
    var hits = [];
    var cursor = -1;
    var lastFocus = null;

    var MAX_RESULTS = 24;

    /* ---------- index loading ---------- */

    function ensureIndex(next) {
        if (docs) { next(); return; }
        queue.push(next);
        if (loading) return;
        loading = true;
        var script = document.createElement('script');
        script.src = base + '_assets/aps-search-index.js';
        script.onload = function () {
            docs = window.__APS_SEARCH__ || [];
            loading = false;
            var pending = queue.splice(0);
            for (var i = 0; i < pending.length; i++) pending[i]();
        };
        script.onerror = function () {
            loading = false;
            queue.length = 0;
            emptyEl.textContent = 'Search index could not be loaded.';
            emptyEl.hidden = false;
        };
        document.head.appendChild(script);
    }

    /* ---------- matching ---------- */

    function tokenize(query) {
        return query
            .toLowerCase()
            .split(/[^0-9a-z\u00c0-\u024f'’-]+/i)
            .filter(function (token) { return token.length >= 2; });
    }

    function score(doc, tokens) {
        var head = ((doc.t || '') + ' ' + (doc.h || '')).toLowerCase();
        var headings = (doc.g || '').toLowerCase();
        var body = (doc.x || '').toLowerCase();
        var total = 0;
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            var inHead = head.indexOf(token) !== -1;
            var inHeadings = headings.indexOf(token) !== -1;
            var inBody = body.indexOf(token) !== -1;
            if (!inHead && !inHeadings && !inBody) return 0; // every token must appear somewhere
            if (inHead) total += 60;
            if (inHeadings) total += 18;
            if (inBody) total += 6;
            if (head.indexOf(token) === 0) total += 25;
        }
        return total;
    }

    function snippet(doc, tokens) {
        var text = doc.x || doc.g || '';
        if (!text) return '';
        var low = text.toLowerCase();
        var at = -1;
        for (var i = 0; i < tokens.length; i++) {
            var pos = low.indexOf(tokens[i]);
            if (pos !== -1 && (at === -1 || pos < at)) at = pos;
        }
        if (at === -1) return text.slice(0, 130);
        var start = Math.max(0, at - 46);
        var end = Math.min(text.length, at + 104);
        return (start > 0 ? '… ' : '') + text.slice(start, end).trim() + (end < text.length ? ' …' : '');
    }

    /* ---------- rendering ---------- */

    function render(tokens) {
        list.textContent = '';
        cursor = -1;

        if (!hits.length) {
            emptyEl.hidden = false;
            var query = input.value.trim();
            emptyEl.textContent = query.length >= 2
                ? 'No page matches “' + query + '”.'
                : 'Type at least two characters — try “REWORK”, “Plane B”, or “auto-ready”.';
            return;
        }
        emptyEl.hidden = true;

        for (var i = 0; i < hits.length; i++) {
            var doc = hits[i];
            var item = document.createElement('li');

            var link = document.createElement('a');
            link.className = 'aps-search-result';
            link.href = base + doc.p;

            var head = document.createElement('span');
            head.className = 'aps-search-result-head';

            var chip = document.createElement('span');
            chip.className = 'aps-search-chip';
            chip.textContent = doc.s || 'Pack';

            var title = document.createElement('span');
            title.className = 'aps-search-title';
            title.textContent = doc.t || doc.h || doc.p;

            head.appendChild(chip);
            head.appendChild(title);
            link.appendChild(head);

            var text = snippet(doc, tokens);
            if (text) {
                var snip = document.createElement('span');
                snip.className = 'aps-search-snippet';
                snip.textContent = text;
                link.appendChild(snip);
            }

            item.appendChild(link);
            list.appendChild(item);
        }
    }

    function run() {
        if (!docs) return;
        var query = input.value.trim();
        if (query.length < 2) { hits = []; render([]); return; }
        var tokens = tokenize(query);
        if (!tokens.length) { hits = []; render([]); return; }

        var scored = [];
        for (var i = 0; i < docs.length; i++) {
            var value = score(docs[i], tokens);
            if (value > 0) scored.push({ doc: docs[i], value: value });
        }
        scored.sort(function (a, b) { return b.value - a.value; });

        hits = [];
        for (var j = 0; j < scored.length && j < MAX_RESULTS; j++) hits.push(scored[j].doc);
        render(tokens);
    }

    /* ---------- selection ---------- */

    function select(next) {
        var links = list.querySelectorAll('.aps-search-result');
        if (!links.length) return;
        if (cursor >= 0 && links[cursor]) links[cursor].classList.remove('is-cursor');
        cursor = (next + links.length) % links.length;
        links[cursor].classList.add('is-cursor');
        links[cursor].scrollIntoView({ block: 'nearest' });
    }

    /* ---------- open / close ---------- */

    function open() {
        if (!dialog.hidden) return;
        lastFocus = document.activeElement;
        dialog.hidden = false;
        document.body.classList.add('aps-search-open');
        input.focus();
        input.select();
        ensureIndex(run);
    }

    function close() {
        if (dialog.hidden) return;
        dialog.hidden = true;
        document.body.classList.remove('aps-search-open');
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }

    /* ---------- wiring ---------- */

    trigger.addEventListener('click', open);

    dialog.addEventListener('click', function (event) {
        if (event.target === dialog) close();
    });

    input.addEventListener('input', run);

    dialog.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); close(); return; }
        if (event.key === 'ArrowDown') { event.preventDefault(); select(cursor + 1); return; }
        if (event.key === 'ArrowUp') { event.preventDefault(); select(cursor - 1); return; }
        if (event.key === 'Enter') {
            var links = list.querySelectorAll('.aps-search-result');
            var target = cursor >= 0 ? links[cursor] : links[0];
            if (target) { event.preventDefault(); window.location.href = target.href; }
        }
    });

    document.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')) {
            event.preventDefault();
            if (dialog.hidden) open(); else close();
        }
    });
})();
