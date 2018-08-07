const path = require("path")

module.exports = {
  output: {
    path: path.resolve(__dirname, "functions-dist")
  },
  target: "node",
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
          //publicPath: "dist/"
          name: "[name].[ext]"
        }
      }
    ]
  }
}
