let is_running = 0
importScripts(
    './node_modules/gl-matrix/dist/gl-matrix.js', 
    'field-solver-common.js'
)


let last_run_vertices = 0
let last_run_iterations = 0
let last_run_time_ms = 0



// TODO: try using WASM (remember to benchmark)
// TODO: return a partially generated line, if it's taking a really long time
function generate_field_line_vertices(starting_point, g_0) {

    const start_time = performance.now()
    
	const vertices = new Float32Array(3 * MAX_VERTICES_PER_LINE)

    let n_vertices = 0

	const r = starting_point.slice(0, 2)
	let g = g_0

	const delta_r = Float32Array.of(0,0)

    vertices[0] = r[0]
    vertices[1] = g
    vertices[2] = r[1]
    n_vertices++


	let delta_pos_prev_prev = Float32Array.of(-1,-1,-1)
	let delta_pos_prev = Float32Array.of(1,1,1)
	let tmp

    let geometry_testing_start_i = 0
    let geometry_testing_start_vertex = 
            Float32Array.of(starting_point[0], g_0 * 100, starting_point[1])
    let geometry_testing_prev_vertex = new Float32Array(3)
    let geometry_testing_current_vertex = new Float32Array(3)

    let geometry_testing_error_area = 0


	let i = 0
	for (; i<iterations; i++) {
		const field = find_field(r)

		const mag_field = small_fast_len2(field)
		if(mag_field > 3) break;

		const mag_second_difference = vec3.distance(delta_pos_prev, delta_pos_prev_prev) || 1.0
		const mag_delta_pos_prev = vec3.length(delta_pos_prev)

		const factor = Math.pow(mag_delta_pos_prev / mag_second_difference, 1/2)

		vec2.scale
			( delta_r
			, field, -nabla * factor) 
		vec2.add
			( r
			, r, delta_r)

		const delta_g = vec2.dot(field, delta_r)
		g += delta_g
		
		
		tmp = delta_pos_prev
		delta_pos_prev = delta_pos_prev_prev // overridden on the next step
		delta_pos_prev_prev = tmp

		
		delta_pos_prev[0] = delta_r[0]
		delta_pos_prev[1] = delta_r[1]
		delta_pos_prev[2] = delta_g


        geometry_testing_current_vertex[0] = r[0]
        geometry_testing_current_vertex[1] = g * 100
        geometry_testing_current_vertex[2] = r[1]

        // aha! this can be done separately from the top! Need to get some
        // actual data on this
		if(i - geometry_testing_start_i > min_resolution) {

            geometry_testing_error_area =+ triangle_area(
                geometry_testing_start_vertex,
                geometry_testing_prev_vertex,
                geometry_testing_current_vertex)

            if(geometry_testing_error_area > max_error_area) {
                vertices.set(geometry_testing_prev_vertex, n_vertices * 3)
                n_vertices++

                geometry_testing_start_vertex.set(geometry_testing_prev_vertex, 0)
                geometry_testing_start_i = i - 1

                //console.log(`pushed (${Math.floor(i/iterations * 100)}%): `, 
                    //r[0], g * 100, r[1], `field = ${field}`, `mag_field = ${mag_field}`)
            }
			
		}
        geometry_testing_prev_vertex.set(geometry_testing_current_vertex)
	}


    const end_time = performance.now()
    const time_ms = end_time - start_time
    last_run_time_ms = time_ms

	console.log(
        `Finished line w/ `
      + `${l_pad(Math.log10(iterations) + 1, i)} iter (rtm=${(i/iterations).toExponential(N_SIG_FIGS - 1)}), `       
      + `${n_vertices} vert, ` 
      + `(rtm=${(n_vertices / MAX_VERTICES_PER_LINE).toExponential(N_SIG_FIGS-1)}), `
      + `in ${Math.round(time_ms)} ms (${(time_ms * 10e6 / n_vertices).toExponential(N_SIG_FIGS - 1)} ns / vert).`
    )


    last_run_vertices = n_vertices
    last_run_iterations = i

    return vertices
}

onmessage = function onmessage(event) {
    if(is_running) 
        throw "already running. can't call me until I postMessage back!"

    is_running = true
    total_iterations = 0
    total_time_ms = 0
    total_vertices = 0

    const result = generate_field_line_vertices(...event.data)
    postMessage({
        result,
        time_ms: last_run_time_ms,
        n_vertices: last_run_vertices,
        iterations: last_run_iterations,
    })
    is_running = false
}

