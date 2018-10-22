const field_solver = require('../../field-solver-common')

exports.test_function = (req, res) => {
    res.status(200).send(bar.name)
}

exports.field_line_vertices = (req, res) => {
	res.set('Access-Control-Allow-Origin', '*')

	field_solver.WasmInitialized.then(() => {
		try {
			const { r_0, r_1, g_0 } = req.query

            // --- show that we're ready from a cold boot ------
            if ( (typeof r_0 === 'undefined')
                && (typeof r_1 === 'undefined')
                && (typeof g_0 === 'undefined')) {
                res.status(204).end()
                console.log("called with no query parameters. ready.")
                return
            }


            // --- normal mode ---------------------------------

			if (typeof r_0 === 'undefined')
				throw new Error('need to provide r_0 query parameter')
			if (typeof r_1 === 'undefined')
				throw new Error('need to provide r_1 query parameter')
			if (typeof g_0 === 'undefined')
				throw new Error('need to provide g_0 query parameter')

			const result = field_solver
                .wasm_generate_field_line_vertices(r_0, r_1, g_0)

			const mapped_result = 
                { ...result
                , vertices: Array.from(result.vertices) }

			res.status(200).send(JSON.stringify(mapped_result))

		} catch (e) {
            res.set('Content-Type', 'application/json; charset=utf-8')
			res.status(500)
                .send(JSON.stringify({ 
                    status: 'server error', 
                    e: e,
                    'e.stack': e.stack 
                }))
		}
	})
}

