

//const headers = {
//'Access-Control-Allow-Origin': '*'
//}

const bar = require('../../bar')
exports.test_function = (req, res) => {
    res.status(200).send(bar.name)
}

const field_solver = require('../../field-solver-common')
exports.field_line_vertices = (req, res) => {
	res.set('Access-Control-Allow-Origin', '*')
	//res.set('Access-Control-Allow-Methods', 'GET')

	//callback(null, {
	//statusCode: 200,
	//headers,
	//body: JSON.stringify(files)
	//})
	//return 

	//console.log('time per call (ms): ' + context.getRemainingTimeInMillis())
	//context.callbackWaitsForEmptyEventLoop = false

	field_solver.WasmInitialized.then(() => {
		try {
			//const { r_0, r_1, g_0 } = event.queryStringParameters
			const { r_0, r_1, g_0 } = req.query

			if (typeof r_0 === "undefined")
				throw new Error("need to provide r_0 query parameter")
			if (typeof r_1 === "undefined")
				throw new Error("need to provide r_1 query parameter")
			if (typeof g_0 === "undefined")
				throw new Error("need to provide g_0 query parameter")

			const result = field_solver
                .wasm_generate_field_line_vertices(r_0, r_1, g_0)

			const mapped_result = {...result, vertices: Array.from(result.vertices)}

			//callback(null, {
			//statusCode: 200,
			//headers,
			//body: JSON.stringify(mapped_result)
			//})
			res.status(200).send(JSON.stringify(mapped_result))

		} catch (e) {

			res.status(400).send("error: " + JSON.stringify(e) + '\n' + e.stack)

			//callback(null, {
			//statusCode: 400,
			//headers,
			//body: "error: " + JSON.stringify(e)
			//})
		}
	})
}

