/**
 * APS method map — read-only OPML mind map.
 *
 * Contract with the build:
 *   - <body data-html-base="">            → relative prefix back to html/
 *   - [data-markmap]                      → host containing <svg class="markmap">
 *   - window.APSMarkmap                   → { Transformer, Markmap } (bundled, no CDN)
 *   - html/maps/02.aps-work-mindmap.opml  → the static map, fetched at runtime
 *   - window.APS_OPML_SNAPSHOT            → inlined copy, used when fetch is blocked (file://)
 *
 * The OPML is parsed in the browser with DOMParser, so the single source of the
 * map lives in `maps/` and is only ever copied — never transformed at build time.
 */
(function () {
    'use strict';

    var host = document.querySelector('[data-markmap]');
    if (!host) return;

    var svg = host.querySelector('svg');
    var statusEl = document.querySelector('[data-markmap-status]');
    var base = document.body.getAttribute('data-html-base') || '';
    var OPML_PATH = 'maps/02.aps-work-mindmap.opml';

    function setStatus(message) {
        if (statusEl) statusEl.textContent = message || '';
    }

    /* Strip the `md/` prefix and swap `.md` → `.html` so OPML notes become wiki links. */
    function noteToLink(note) {
        var m = note && note.match(/md\/[A-Za-z0-9._\/-]+\.md/);
        if (!m) return null;
        return m[0].replace(/^md\//, '').replace(/\.md$/, '.html');
    }

    function indent(level) {
        var out = '';
        for (var i = 0; i < level; i++) out += '  ';
        return out;
    }

    function walk(node, level, lines) {
        var kids = node.children;
        for (var i = 0; i < kids.length; i++) {
            var outline = kids[i];
            if (!outline.tagName || outline.tagName.toLowerCase() !== 'outline') continue;
            var label = outline.getAttribute('text') || '';
            var note = outline.getAttribute('_note') || '';
            var hasChildren = outline.querySelectorAll(':scope > outline').length > 0;
            var link = hasChildren ? null : noteToLink(note);
            lines.push(indent(level) + (link ? '- [' + label + '](' + link + ')' : '- ' + label));
            if (hasChildren) walk(outline, level + 1, lines);
        }
    }

    function opmlToMarkdown(text) {
        var doc = new DOMParser().parseFromString(text, 'text/xml');
        if (doc.querySelector('parsererror')) throw new Error('OPML parse error');
        var body = doc.querySelector('body');
        if (!body) throw new Error('OPML body missing');
        var lines = ['# APS — work mind map', ''];
        walk(body, 0, lines);
        return lines.join('\n');
    }

    async function readOpml() {
        try {
            var res = await fetch(base + OPML_PATH, { cache: 'no-store' });
            if (res.ok) {
                setStatus('');
                return await res.text();
            }
        } catch (err) {
            /* file:// blocks fetch — fall through to the inlined copy. */
        }
        if (typeof window.APS_OPML_SNAPSHOT === 'string' && window.APS_OPML_SNAPSHOT) {
            setStatus('Offline — showing the copy bundled with this page.');
            return window.APS_OPML_SNAPSHOT;
        }
        throw new Error('OPML unavailable');
    }

    (async function render() {
        var lib = window.APSMarkmap;
        if (!lib || !lib.Transformer || !lib.Markmap) {
            setStatus('The mind-map library could not be loaded.');
            return;
        }

        var text;
        try {
            text = await readOpml();
        } catch (err) {
            setStatus('Could not load the mind map.');
            return;
        }

        var markdown;
        try {
            markdown = opmlToMarkdown(text);
        } catch (err) {
            setStatus('Could not parse the mind map.');
            return;
        }

        try {
            var transformer = new lib.Transformer();
            var result = transformer.transform(markdown);
            lib.Markmap.create(svg, { autoFit: true, duration: 250, maxWidth: 340 }, result.root);
        } catch (err) {
            setStatus('Could not render the mind map.');
        }
    })();
})();
