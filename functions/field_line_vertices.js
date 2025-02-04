const field_solver = require('../../field-solver-common')


export default async (req, ctx) => {

    const headers = { 
        'Access-Control-Allow-Origin': '*', 
        'Content-Type':  'application/json; charset=utf-8' 
    } 
    const query = new URLSearchParams((new URL(req.url)).search)

    
    field_solver.WasmInitialized.then(() => {
        try {
            // --- show that we're ready from a cold boot ------
            if (!query.has('r_0')
                && !query.has('r_1')
                && !query.has('g_1')) {

                console.log("called with no query parameters. ready.")
                return new Response(null, { status: 204, headers })
            }


            // --- normal mode ---------------------------------

            if (!query.has('r_0'))
                throw new Error('need to provide r_0 query parameter')
            if (!query.has('r_1'))
                throw new Error('need to provide r_1 query parameter')
            if (!query.has('g_1'))
                throw new Error('need to provide g_0 query parameter')


            const result = field_solver
                .wasm_generate_field_line_vertices(query.get('r_0'), query.get('r_1'), query.get('g_0')
            

            const mapped_result = 
                { ...result
                    , vertices: Array.from(result.vertices) }

            return new Response(JSON.stringify(mapped_result), { headers }) 

        } catch (e) {
            return new Response(JSON.stringify({ 
                    status: 'server error', 
                    e: e,
                    'e.stack': e.stack 
                }), { status: 500, headers })
        }
    })
}

