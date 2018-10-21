const path = require("path")

module.exports = {
  entry: {
    functions: './functions/default/index.js'
  },
  output: {
    path: __dirname + "/functions-dist/default",
    filename: "index.js",
    library: "electric_field_solver",
    libraryTarget: "umd",
  },
  target: "node",
  mode: "production",
  node: {
    __dirname: false,
    __filename: false
  },
  module: {
    rules: [
      {
        test: /\.wasm$/,
        loader: "file-loader",
        options: {
          //publicPath: "dist/",
          name: "[name].[ext]"
        },
        type: "javascript/auto"
      }
    ]
  }
}
