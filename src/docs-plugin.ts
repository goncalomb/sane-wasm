import { Application, DefaultThemeRenderContext, JSX } from 'typedoc';

/**
 * TypeDoc plugin to improve documentation pages.
 *
 * One future improvement could be adding support for custom .md pages,
 * that would allow the main README.md to be split into multiple files.
 */
export function load(app: Application) {
    // remove site menu on index.html
    app.renderer.hooks.on('head.end', (context: DefaultThemeRenderContext) => {
        if (context.page.url === 'index.html') {
            return JSX.createElement('style', null, '.site-menu, .tsd-filter-visibility { display: none; }');
        }
        return JSX.createElement(JSX.Fragment, null);
    });
}
