//const fs = require('fs')

//console.log('__dirname: ' + __dirname)

//console.log('directory listing: ')
//const files = fs.readdirSync(__dirname)
//console.log(' ')

const field_solver = require("../field-solver-common")

//const initialized = new Promise(res => {

//process.on('unhandledRejection', (reason, p) => {
//console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
//// application specific logging, throwing an error, or other logic here
//console.log(reason.stack)
//})

//res()
//})

const headers = {
  'Access-Control-Allow-Origin': '*'
}

exports.handler = function(event, context, callback) {
  //callback(null, {
    //statusCode: 200,
    //headers,
    //body: JSON.stringify(files)
  //})
  //return 
  field_solver.WasmInitialized.then(() => {
    try {
      const { r_0, r_1, g_0 } = event.queryStringParameters

      if (typeof r_0 === "undefined")
        throw new Error("need to provide r0 query parameter")
      if (typeof r_1 === "undefined")
        throw new Error("need to provide r1 query parameter")
      if (typeof g_0 === "undefined")
        throw new Error("need to provide g0 query parameter")

      const result = field_solver.wasm_generate_field_line_vertices(
        r_0, r_1, g_0)

      const mapped_result = {...result, vertices: Array.from(result.vertices)}

      callback(null, {
        statusCode: 200,
        headers,
        body: JSON.stringify(mapped_result)
      })

    } catch (e) {
      callback(null, {
        statusCode: 400,
        headers,
        body: "error: " + JSON.stringify(e)
      })
    }
  })
}
