const path = require('path');
const fs = require('fs');
const webpack = require('webpack');
const StatsPlugin = require('stats-webpack-plugin');
const loadersByExtension = require('./webpack/lib/loadersByExtension');

module.exports = function(options) {
    const VERSION = require('./package.json').version;
    const PACKAGE_NAME = require('./package.json').name;
    const LICENSE = fs.readFileSync('LICENSE', 'utf8');

    const config = require('./config/default/config.json');

    try {
        Object.assign(config, require('./config/config.json'));
    }
    catch (e) {
        // do nothing
    }

    var entry = options.assetsOnly ? {
        assets: './src/js/constants/assets'
    } : {
        smooch: ['./src/js/utils/polyfills', './src/js/main']
    };

    var loaders = {
        'jsx': options.hotComponents ? ['react-hot-loader', 'babel-loader'] : 'babel-loader',
        'js': {
            loader: 'babel-loader',
            include: [path.join(__dirname, 'src/js'), path.join(__dirname, 'test')]
        },
        'json': 'json-loader',
        'txt': 'raw-loader',
        'png|jpg|jpeg|gif|svg': 'url-loader?limit=1',
        'woff|woff2': 'url-loader?limit=1',
        'mp3': 'url-loader?limit=1',
        'ttf|eot': 'file-loader'
    };
    var cssLoader = options.minimize ? 'css-loader?insertAt=top' : 'css-loader?insertAt=top&localIdentName=[path][name]---[local]---[hash:base64:5]';
    var stylesheetLoaders = {
        'css': cssLoader,
        'less': [cssLoader, 'less-loader']
    };
    var additionalLoaders = [
        {
            test: /load-image/,
            loader: 'imports?define=>false'
        }
    ];

    var alias = {};

    var externals = [];
    var modulesDirectories = ['node_modules'];
    var extensions = ['', '.web.js', '.js', '.jsx'];
    var publicPath = options.devServer ?
        'http://' + config.SERVER_HOST + '/_assets/' :
        'https://cdn.smooch.io/';

    var output = {
        path: options.outputPath || path.join(__dirname, 'dist'),
        publicPath: publicPath,
        filename: '[name].js' + (options.longTermCaching ? '?[chunkhash]' : ''),
        chunkFilename: '[chunkhash].js',
        sourceMapFilename: '[file].map',
        library: options.assetsOnly ? undefined : 'Smooch',
        libraryTarget: options.assetsOnly ? 'commonjs2' : 'umd',
        umdNamedDefine: true,
        pathinfo: options.debug
    };

    var excludeFromStats = [
        /node_modules[\\\/]/
    ];

    var plugins = [
        new webpack.PrefetchPlugin('react'),
        new webpack.PrefetchPlugin('react/lib/ReactComponentBrowserEnvironment')
    ];


    if (!options.test && !options.assetsOnly) {
        plugins.push(new StatsPlugin('stats.json', {
            chunkModules: true,
            exclude: excludeFromStats
        }));
    }

    Object.keys(stylesheetLoaders).forEach(function(ext) {
        var stylesheetLoader = stylesheetLoaders[ext];
        if (Array.isArray(stylesheetLoader)) {
            stylesheetLoader = stylesheetLoader.join('!');
        }

        stylesheetLoaders[ext] = 'style/useable!' + stylesheetLoader;
    });

    if (options.minimize) {
        plugins.push(
            new webpack.optimize.UglifyJsPlugin({
                compressor: {
                    warnings: false
                }
            }),
            new webpack.optimize.DedupePlugin(),
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify('production')
                }
            }),
            new webpack.NoErrorsPlugin(),

            new webpack.BannerPlugin(PACKAGE_NAME + ' ' + VERSION + ' \n' + LICENSE)
        );
    } else if (options.test) {
        plugins.push(
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify('test')
                }
            })
        );
    } else if (options.assetsOnly) {
        plugins.push(
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify('test')
                }
            })
        );
    } else {
        plugins.push(
            new webpack.DefinePlugin({
                'process.env': {
                    NODE_ENV: JSON.stringify('development')
                }
            })
        );
    }

    return {
        entry: entry,
        output: output,
        target: 'web',
        module: {
            loaders: loadersByExtension(loaders).concat(loadersByExtension(stylesheetLoaders)).concat(additionalLoaders)
        },
        devtool: options.devtool,
        debug: options.debug,
        resolveLoader: {
            root: path.join(__dirname, 'node_modules')
        },
        externals: externals,
        resolve: {
            modules: modulesDirectories,
            extensions: extensions,
            alias: alias
        },
        plugins: plugins,
        devServer: {
            host: config.SERVER_HOST.split(':')[0],
            port: config.SERVER_HOST.split(':')[1],
            stats: {
                cached: false,
                exclude: excludeFromStats
            }
        }
    };
};
