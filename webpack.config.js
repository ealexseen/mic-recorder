const path = require('path');

const configPublic = {
    mode: 'development', // development|production
    entry: {
        'index': './src/index.js',
    },
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].js',
    },
    module: {
        rules: [
            {
                test: /\.(js)?$/,
                loader: 'babel-loader',
                include: [
                    path.join(__dirname, 'src'),
                ],
                options: {
                    babelrc: false,
                    presets: [
                        [
                            '@babel/preset-env',
                            {
                                loose: true,
                                modules: false,
                            },
                        ],
                    ],
                    plugins: [
                        '@babel/proposal-object-rest-spread',
                        ['@babel/plugin-proposal-decorators', { legacy: true }],
                        ['@babel/plugin-proposal-class-properties', { loose: true }],
                        'dynamic-import-node',
                        '@babel/plugin-syntax-dynamic-import',
                        '@babel/plugin-transform-runtime',
                    ],
                },
            },
        ],
    },
};

module.exports = [
    configPublic,
];