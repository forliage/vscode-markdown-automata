const path = require("path");

/** @type {import('webpack').Configuration[]} */
module.exports = [
  {
    target: "node",
    entry: "./src/extension.ts",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "extension.js",
      libraryTarget: "commonjs2"
    },
    resolve: { extensions: [".ts", ".js"] },
    module: { rules: [{ test: /\.ts$/, use: "ts-loader", exclude: /node_modules/ }] },
    externals: { vscode: "commonjs vscode" }
  },
  {
    target: "node",
    entry: "./src/cli.ts",
    output: { path: path.resolve(__dirname, "dist"), filename: "cli.js" },
    resolve: { extensions: [".ts", ".js"] },
    module: { rules: [{ test: /\.ts$/, use: "ts-loader", exclude: /node_modules/ }] }
  }
];
