import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'node:path';
import webpack from 'webpack';

export default {
    mode: 'development',
    entry: './src/index.js',
    plugins: [
        new webpack.NormalModuleReplacementPlugin(/^node:/, r => r.request = 'data:,'),
        new HtmlWebpackPlugin({
            title: 'sane-wasm webpack example',
        }),
    ],
    output: {
        path: path.resolve(import.meta.dirname, 'dist'),
        chunkFormat: 'module',
        clean: true,
    },
    devServer: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
    },
};
