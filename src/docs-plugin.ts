import { Application, DefaultThemeRenderContext, JSX } from 'typedoc';

/**
 * TypeDoc plugin to improve documentation pages.
 *
 * One future improvement could be adding support for custom .md pages,
 * that would allow the main README.md to be split into multiple files.
 */
export function load(app: Application) {
    // remove site menu and other elements on index.html
    app.renderer.hooks.on('head.end', (context: DefaultThemeRenderContext) => {
        if (context.page.url === 'index.html') {
            return JSX.createElement('style', null, '.site-menu, .tsd-page-title, .tsd-filter-visibility { display: none; }');
        }
        return JSX.createElement(JSX.Fragment, null);
    });

    // allow relative links on toolbar
    app.renderer.hooks.on('body.end', (context: DefaultThemeRenderContext) => {
        return JSX.createElement('script', null, JSX.createElement(JSX.Raw, {
            html: `
((els, base) => {
    els.forEach(el => {
        const href = el.getAttribute('href');
        if (href.startsWith('/')) {
            el.setAttribute('href',\`\${base}\${href}\`);
        }
    });
})(
    document.querySelectorAll('#tsd-toolbar-links a'),
    document.getElementById('tsd-search').dataset.base
);
`,
        }));
    });
}
